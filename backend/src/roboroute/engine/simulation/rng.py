"""Reproducible, independent random streams.

Every family of random variables gets its own PCG64 stream derived from
``SeedSequence(seed, spawn_key=(crc32(key), kind))``, where ``key`` is a mission id (or a travel
leg such as ``"start->bridge"``). Consequences:

- the same seed always gives the same results (reproducibility);
- adding, removing or reordering missions does not shift the random numbers of the others;
- two plans simulated with the same seed see the *same* draws for each mission — *common random
  numbers* — so their difference has much less noise than two independent simulations.

NumPy guarantees that PCG64 bit streams are stable across versions, but not that distribution
methods are; results therefore record the NumPy version.
"""

import zlib
from enum import IntEnum

import numpy as np


class Kind(IntEnum):
    EXECUTION = 1
    RETRY = 2
    SUCCESS = 3
    TRAVEL = 4


def stream(seed: int, key: str, kind: Kind) -> np.random.Generator:
    sequence = np.random.SeedSequence(seed, spawn_key=(zlib.crc32(key.encode("utf-8")), int(kind)))
    return np.random.Generator(np.random.PCG64(sequence))
