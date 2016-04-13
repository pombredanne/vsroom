import os
import fcntl
import heapq
import struct
import collections

from hashlib import md5 as checksum

class HeaderError(Exception):
    pass

class Header(object):
    format = struct.Struct("!QQQQQQ")
    size = len(checksum().digest()) + format.size

    @classmethod
    def unpack(cls, data):
        digest = data[cls.format.size:]
        if digest != checksum(data[:cls.format.size]).digest():
            raise HeaderError("header data does not match the checksum")
        unpacked = cls.format.unpack(data[:cls.format.size])
        return cls(*unpacked)

    def __init__(self, last_commit, count, last, tail, open_head, open_tail):
        self.last_commit = last_commit

        self.count = count
        self.last = last
        self.tail = tail

        self.open_head = open_head
        self.open_tail = open_tail

    def pack(self):
        data = self.format.pack(self.last_commit,
                                self.count, self.last, self.tail,
                                self.open_head, self.open_tail)
        return data + checksum(data).digest()

class Record(object):
    format = struct.Struct("!QQQQQQ")

    __slots__ = "back", "left", "right", "start", "end", "obj"

    @classmethod
    def unpack_from_file(cls, file):
        data = file.read(cls.format.size)
        back, left, right, start, end, size = cls.format.unpack(data)
        if size >= cls.format.size:
            obj = file.read(size-cls.format.size)
        else:
            size = cls.format.size
            obj = None
        return size, cls(back, left, right, start, end, obj)

    def __init__(self, back, left, right, start, end, obj):
        self.back = back
        self.left = left if back != left else None
        self.right = right if back != right else None

        self.start = start
        self.end = end
        self.obj = obj

    def pack(self):
        back = self.back
        left = self.left if self.left is not None else back
        right = self.right if self.right is not None else back

        start = self.start
        end = self.end

        if self.obj is not None:
            obj = self.obj
            size = self.format.size + len(self.obj)
        else:
            obj = ""
            size = 0
        return self.format.pack(back, left, right, start, end, size) + obj

class DB(object):
    def read_header(self):
        self.file.seek(0)

        data = self.file.read(2 * Header.size)
        if len(data) < 2 * Header.size:
            return Header(0, 0, 2 * Header.size, 2 * Header.size, 0, 0)

        try:
            return Header.unpack(data[:Header.size])
        except HeaderError:
            pass
        return Header.unpack(data[Header.size:])

    def read_record(self, header, offset):
        self.file.seek(offset)
        return Record.unpack_from_file(self.file)

    def read_stack(self, header):
        if header.count == 0:
            return list()

        stack = list()
        offset = header.last
        while True:
            _, record = self.read_record(header, offset)
            stack.append((offset, record))
            if record.back == offset:
                break
            offset = record.back
        stack.reverse()
        return stack

    def read_opened(self, header):
        opened = list()

        offset = header.open_head
        while offset < header.open_tail:
            size, record = self.read_record(header, offset)
            opened.append(record)
            offset += size

        return opened

    def prune_opened(self, opened):
        by_id = dict()

        for record in opened:
            if record.obj is not None:
                by_id[record.back] = record
            else:
                by_id.pop(record.back, None)

        return list(by_id.values())

    POS_INFINITY = float("inf")
    NEG_INFINITY = float("-inf")

    def query(self, start=None, end=None):
        if end is None:
            end = self.POS_INFINITY
        if start is None:
            start = self.NEG_INFINITY

        heap = list()
        header = self.read_header()
        for record in self.prune_opened(self.read_opened(header)):
            heapq.heappush(heap, (self.NEG_INFINITY, -record.start, record))
        for _, record in self.read_stack(header):
            heapq.heappush(heap, (-record.end, -record.start, record))

        while heap:
            r_end, r_start, record = heapq.heappop(heap)
            r_end = -r_end
            r_start = -r_start
            if r_end <= start or r_start >= end:
                continue

            if r_start == self.NEG_INFINITY:
                r_start = None
            if r_end == self.POS_INFINITY:
                r_end = None
            if record.obj is not None:
                yield r_start, r_end, record.obj

            if record.left is not None:
                _, item = self.read_record(header, record.left)
                heapq.heappush(heap, (-item.end, -item.start, item))
            if record.right is not None:
                _, item = self.read_record(header, record.right)
                heapq.heappush(heap, (-item.end, -item.start, item))

class Writer(DB):
    def __init__(self, filename):
        fd = os.open(filename, os.O_RDWR | os.O_CREAT)
        self.file = os.fdopen(fd, "r+b")
        try:
            fcntl.lockf(self.file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except IOError:
            self.file.close()
            raise

        self.header = self.read_header()

        self.closed_stack = self.read_stack(self.header)
        self.closed_pending = list()

        self.open_ids = dict()
        self.open_order = collections.deque()
        self.open_pending = dict()

        for record in self.read_opened(self.header):
            self.open_order.append((record.back, record, record.pack()))
            self.open_ids[record.back] = record
        for id in self.open_ids:
            self.set_obj(self.header.last_commit, id, None)

    def flush(self):
        self.file.flush()
        os.fsync(self.file.fileno())

    def close(self, timestamp):
        self.commit(timestamp)
        fcntl.lockf(self.file.fileno(), fcntl.LOCK_UN)
        self.file.close()

    def write(self, offset, data):
        self.file.seek(offset)
        self.file.write(data)

    def set_obj(self, timestamp, id, obj):
        if id in self.open_pending:
            prev_ts, prev_obj = self.open_pending[id]
            if prev_obj is not None:
                self.append_obj(prev_ts, timestamp, prev_obj)
        elif id in self.open_ids:
            record = self.open_ids[id]
            self.append_obj(record.start, timestamp, record.obj)

        self.open_pending[id] = timestamp, obj

    def append_obj(self, start, end, obj):
        self.closed_pending.append((start, end, obj))

    def commit(self, timestamp):
        self.header.last_commit = timestamp

        for tail in self.commit_closed():
            self.ensure_free_space(tail)
            self.commit_header()
        self.commit_open()
        self.commit_header()

    def commit_closed(self):
        count = self.header.count
        tail = self.header.tail
        last = self.header.last

        closed = list()
        for start, end, obj in self.closed_pending:
            count += 1
            level = 0
            while count % (2**level) == 0:
                if level != 0:
                    right, right_record = self.closed_stack.pop()
                    left, left_record = self.closed_stack.pop()
                    start = min(right_record.start, left_record.start)
                    end = max(right_record.end, left_record.end)
                    obj = None
                else:
                    right = left = None

                if self.closed_stack:
                    back, _ = self.closed_stack[-1]
                else:
                    back = tail

                record = Record(back, left, right, start, end, obj)
                self.closed_stack.append((tail, record))

                data = record.pack()
                closed.append(data)
                last = tail
                tail += len(data)

                level += 1
        self.closed_pending = list()

        yield tail

        closed = "".join(closed)
        self.write(self.header.tail, closed)

        self.header.count = count
        self.header.last = last
        self.header.tail = tail

    def ensure_free_space(self, tail):
        moved = list()

        while self.open_order and self.header.open_head < tail:
            id, record, data = self.open_order.popleft()
            self.header.open_head += len(data)

            if self.open_ids.get(id, None) is record:
                moved.append((id, record, data))

        if __debug__:
            rest = sum(len(data) for (id, record, data) in self.open_order)
            diff = self.header.open_tail - self.header.open_head
            assert rest == diff

        if not self.open_order:
            self.header.open_head = max(tail, self.header.open_tail)
            self.header.open_tail = self.header.open_head

        self.open_order.extend(moved)

        moved = "".join(data for (_, _, data) in moved)
        self.write(self.header.open_tail, moved)
        self.header.open_tail += len(moved)
        self.flush()

    def commit_open(self):
        opened = list()
        for id, (start, obj) in self.open_pending.iteritems():
            old_record = self.open_ids.pop(id, None)
            if old_record is None and obj is None:
                continue

            back = old_record.back if old_record else self.header.open_tail
            record = Record(back, None, None, start, 0, obj)
            if record.obj is not None:
                self.open_ids[id] = record

            data = record.pack()
            opened.append(data)
            self.header.open_tail += len(data)
            self.open_order.append((id, record, data))
        self.open_pending.clear()

        opened = "".join(opened)
        self.write(self.header.open_tail-len(opened), opened)
        self.flush()

    def commit_header(self):
        data = self.header.pack()

        self.write(0, data)
        self.flush()

        self.write(Header.size, data)
        self.flush()

if __name__ == "__main__":
    import shutil
    import tempfile
    import unittest

    class TestWriter(unittest.TestCase):
        def setUp(self):
            self.temp_dir = tempfile.mkdtemp()
            self.writer = None

            self.reopen()

        def tearDown(self):
            try:
                if self.writer:
                    self.writer.close(0)
                    self.writer = None
            finally:
                shutil.rmtree(self.temp_dir)

        def reopen(self):
            if self.writer:
                self.writer.close(0)
            self.writer = Writer(os.path.join(self.temp_dir, "tmp.db"))

        def test_open(self):
            # Regression test: When all open records got moved in
            # ensure_free_space but tail < open_tail, the result moving
            # was open_tail < open_head.

            self.writer.set_obj(0, 0, "a" * 1024)
            self.writer.commit(0)

            self.writer.append_obj(0, 0, "")
            self.writer.commit(0)

            self.reopen()

        def test_auto_closing(self):
            # Regression test. Automatic closing of events from the
            # last session caused the data to corrupt after a couple
            # of reopenings. The code assumed that read_opened method
            # returned all records in the open queue in the correct
            # order. This was not the case.

            self.writer.set_obj(0, 0, "")
            self.reopen()
            self.reopen()
            self.reopen()

        def test_query_limits(self):
            self.writer.append_obj(0, 1, "")
            self.writer.commit(1)

            assert len(list(self.writer.query())) == 1
            assert len(list(self.writer.query(end=0))) == 0
            assert len(list(self.writer.query(start=1))) == 0
            assert len(list(self.writer.query(start=0.5, end=0.5))) == 1

    unittest.main()
