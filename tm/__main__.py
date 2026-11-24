"""Allows `python -m tm` to start the terminal interface."""
import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())