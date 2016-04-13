import hashlib
def create_id(event, *keys, **extra):
    digest = hashlib.md5()
    for key in sorted(extra.keys()):
        digest.update(extra[key].encode("utf-8"))

    for key in sorted(keys):
        for value in event.values(key):
            digest.update(value.encode("utf-8"))
    return digest.hexdigest()
