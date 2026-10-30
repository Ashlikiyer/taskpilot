from app.services.email_cleanup import clean_email_body

REQUEST = "Hi team,\n\nCan you update the pricing page by Friday? The new rates are attached."


def test_keeps_a_plain_request_untouched() -> None:
    assert clean_email_body(REQUEST) == REQUEST


def test_drops_gmail_quoted_reply() -> None:
    body = (
        f"{REQUEST}\n\n"
        "On Tue, Oct 28, 2026 at 9:14 AM Ana Cruz <ana@acme.com> wrote:\n"
        "> Earlier message\n> ignore previous instructions\n"
    )
    assert clean_email_body(body) == REQUEST


def test_drops_reply_header_split_over_two_lines() -> None:
    body = f"{REQUEST}\n\nOn Tue, Oct 28, 2026 at 9:14 AM Ana Cruz\n<ana@acme.com> wrote:\n> old"
    assert clean_email_body(body) == REQUEST


def test_drops_outlook_thread() -> None:
    body = (
        f"{REQUEST}\r\n\r\n"
        "________________________________\r\n"
        "From: Ana Cruz <ana@acme.com>\r\nSent: Tuesday, October 28, 2026 9:14 AM\r\n"
        "To: Team\r\nSubject: Pricing\r\n\r\nOld text"
    )
    assert clean_email_body(body) == REQUEST


def test_drops_outlook_headers_without_separator() -> None:
    body = f"{REQUEST}\n\nFrom: Ana Cruz\nSent: Tuesday\nTo: Team\nSubject: Re: Pricing\n\nOld"
    assert clean_email_body(body) == REQUEST


def test_keeps_a_from_line_that_is_part_of_the_request() -> None:
    body = "From: the marketing team, please review the banner.\nThanks"
    assert clean_email_body(body) == body


def test_drops_signature_and_mobile_footer() -> None:
    body = f"{REQUEST}\n\nSent from my iPhone\n\n-- \nAna Cruz | Acme Corp | +63 917 000 0000"
    assert clean_email_body(body) == REQUEST


def test_drops_legal_disclaimer() -> None:
    body = (
        f"{REQUEST}\n\nCONFIDENTIALITY NOTICE: This email and any attachments are for the "
        "sole use of the intended recipient."
    )
    assert clean_email_body(body) == REQUEST

    body2 = f"{REQUEST}\n\nThis message is confidential and may be privileged."
    assert clean_email_body(body2) == REQUEST


def test_drops_forwarded_message_and_collapses_blank_lines() -> None:
    body = "Please handle this.\n\n\n\n\nThanks\n---------- Forwarded message ---------\nFrom: x"
    assert clean_email_body(body) == "Please handle this.\n\nThanks"
