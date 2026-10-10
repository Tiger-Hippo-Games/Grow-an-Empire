"""Shared steps for the QA scripts: get from the campaign map into play, and play moves the way a player would.

Works on a Page or a Frame (both have is_visible / click / locator).
"""


def enter(page, skip_tutorial=True, timeout=10000):
    """Campaign map -> enemy briefing -> the city. Skips the tutorial unless asked not to."""
    page.wait_for_selector("#campaign-launch", state="visible", timeout=timeout)
    page.click("#campaign-launch")
    page.wait_for_timeout(300)
    if page.is_visible(".flow-dialog [data-action=begin]"):
        page.click(".flow-dialog [data-action=begin]")
        page.wait_for_timeout(200)
    if skip_tutorial and page.is_visible("#tutorial-skip"):
        page.click("#tutorial-skip")


CHOICE = "#build-panel:not(.hidden) .build-card, #build-panel:not(.hidden) .gather-button, #build-panel:not(.hidden) .report-continue"


def past_report(page, timeout=30000):
    """From move 2 on, the last move's report shows before the cards: read it (press Choose)."""
    if page.is_visible("#build-panel:not(.hidden) .report-continue"):
        page.click("#build-panel .report-continue")
        page.wait_for_selector("#build-panel:not(.hidden) .build-card, #build-panel:not(.hidden) .gather-button", timeout=timeout)


def play_move(page, timeout=30000):
    """Builds the first affordable card, else swaps at the Bazaar, else gathers. Returns what it did."""
    page.wait_for_selector(CHOICE, timeout=timeout)
    past_report(page, timeout)
    for selector, kind in (("#build-options .build-card.affordable", "built"), ("#build-options .build-card.swappable", "swapped"), ("#build-foot .gather-button", "gathered")):
        target = page.locator(selector)
        if target.count():
            target.first.click()
            return kind
    raise AssertionError("no playable card and no Gather button")


def at_muster(page):
    return page.is_visible(".flow-dialog[data-kind=muster]")


def play_to_muster(page, on_move=None, timeout=40000):
    """Plays moves until the muster dialog opens. `on_move(move_number)` runs before each move."""
    for _ in range(40):
        page.wait_for_selector(f"{CHOICE}, .flow-dialog[data-kind=muster]", timeout=timeout)
        if at_muster(page):
            return
        move = int(page.inner_text("#move").split(" ")[0])
        if on_move:
            on_move(move)
            if at_muster(page):
                return
            page.wait_for_selector(CHOICE, timeout=timeout)
        play_move(page)
        page.wait_for_timeout(150)
    raise AssertionError("never reached the muster")


def fight(page, best=True):
    """At the muster: optionally hire sellswords, fight in the popup, skip, and return the result text."""
    if best and page.is_visible(".flow-dialog [data-action=best]"):
        page.click(".flow-dialog [data-action=best]")
    page.click(".flow-dialog [data-action=fight]")
    page.wait_for_selector(".flow-dialog[data-kind=battle], .flow-dialog[data-kind=result]", timeout=5000)
    if page.is_visible(".flow-dialog[data-kind=battle] [data-action=skip]"):
        try:
            page.click(".flow-dialog[data-kind=battle] [data-action=skip]", timeout=2000)
        except Exception:
            pass  # The fight ended on its own first.
    page.wait_for_selector(".flow-dialog[data-kind=result]", timeout=5000)
    return page.inner_text(".flow-dialog")


def speed8(page):
    """Sets 8x with the S shortcut (the default is 4x since v0.8.0, so S cycles 4 -> 8 -> 1 -> 2)."""
    for _ in range(4):
        if "8" in (page.evaluate("document.getElementById('speed-value')?.textContent || ''") or ""):
            return
        page.keyboard.press("s")
