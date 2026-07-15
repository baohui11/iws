import io
import unittest

from pypdf import PdfReader, PdfWriter

from iws_file_worker.parse import split_pdf_for_ocr


def make_pdf(page_count: int) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=72, height=72)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class SplitPdfForOcrTests(unittest.TestCase):
    def test_keeps_single_small_pdf_unchanged(self) -> None:
        data = make_pdf(2)
        self.assertEqual([(1, data)], split_pdf_for_ocr(data, 2))

    def test_splits_and_retains_page_offsets(self) -> None:
        batches = split_pdf_for_ocr(make_pdf(5), 2)
        self.assertEqual([1, 3, 5], [start for start, _ in batches])
        self.assertEqual([2, 2, 1], [len(PdfReader(io.BytesIO(data)).pages) for _, data in batches])

