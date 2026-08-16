import os
from setuptools import setup, find_packages

this_directory = os.path.abspath(os.path.dirname(__file__))
with open(os.path.join(this_directory, "README.md"), encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="quota-sdk",
    version="1.1.3",
    description="Official Python SDK for Quota: LLM Telemetry, Proxy & MCP Interceptor",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Quota",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
