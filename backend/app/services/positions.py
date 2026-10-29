"""Fractional ordering for tasks within a board column.

A card dropped between two others gets the midpoint of their positions, so no other
row changes. Repeated drops into the same gap halve it each time; once the gap is too
small to split reliably, the column is renumbered with even spacing.
"""

GAP = 1024.0
MIN_GAP = 1e-6


def between(before: float | None, after: float | None) -> float | None:
    """Position for a card placed after `before` and ahead of `after` (None = column edge).

    Returns None when the two neighbours are too close and the column needs rebalancing.
    """
    if before is None and after is None:
        return GAP
    if before is None:
        assert after is not None
        return after - GAP
    if after is None:
        return before + GAP
    if after - before < MIN_GAP:
        return None
    return (before + after) / 2


def evenly_spaced(count: int) -> list[float]:
    return [GAP * (index + 1) for index in range(count)]
