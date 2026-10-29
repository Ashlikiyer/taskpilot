from app.services.positions import GAP, between, evenly_spaced


def test_first_card_in_empty_column() -> None:
    assert between(None, None) == GAP


def test_top_and_bottom_of_column() -> None:
    assert between(None, 1024.0) == 0.0
    assert between(2048.0, None) == 2048.0 + GAP


def test_midpoint_between_two_cards() -> None:
    assert between(1024.0, 2048.0) == 1536.0


def test_tiny_gap_asks_for_rebalance() -> None:
    assert between(1.0, 1.0 + 1e-9) is None


def test_repeated_inserts_eventually_need_rebalance() -> None:
    low, high = 1024.0, 2048.0
    splits = 0
    while (mid := between(low, high)) is not None:
        high = mid
        splits += 1
    assert 20 < splits < 60


def test_evenly_spaced() -> None:
    assert evenly_spaced(3) == [GAP, 2 * GAP, 3 * GAP]
