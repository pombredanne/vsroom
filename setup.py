import os
import sys
import imp
import warnings
import platform
from distutils.core import setup

def generate_version():
    base_path, _ = os.path.split(__file__)
    module_path = os.path.join(base_path, "vsroom", "common")

    module_info = imp.find_module("version", [module_path])
    version_module = imp.load_module("version", *module_info)

    version_module.generate(base_path)
    return version_module.version_str()
version = generate_version()

def collect_data_files(src, dst):
    paths = list()

    cwd = os.getcwd()
    try:
        os.chdir(src)

        for dirpath, dirnames, filenames in os.walk("."):
            collected = list()

            for filename in filenames:
                normalized = os.path.normpath(os.path.join(src, dirpath, filename))
                collected.append(os.path.normpath(normalized))

            if collected:
                basedir = os.path.normpath(os.path.join(dst, dirpath))
                paths.append((basedir, collected))
    finally:
        os.chdir(cwd)
    return paths

setup(
    name="vsroom",
    version="1.r"+version,
    packages=[
        "vsroom",
        "vsroom.common",
        "vsroom.common.sanitizers",
        "vsroom.common.relations"
    ],
    data_files=collect_data_files(
        "vsr/javascript",
        "share/vsroom/htdocs"
    ),
    description=(
        "A framework for collecting, "+
        "aggregating, and visualizing "+
        "any number of data sources."
    ),
    long_description=(
        "Virtual Situation Room framework "+
        "provides highly modular tools "+
        "to collect information from varying sources. "+
        "This information can then be visualized "+
        "to gain situational awareness."
    ),
    author="Clarified Networks",
    author_email="contact@clarifiednetworks.com",
    url="https://github.com/softcert/vsroom",
    download_url="https://github.com/softcert/vsroom/downloads",
    license="MIT",
)

