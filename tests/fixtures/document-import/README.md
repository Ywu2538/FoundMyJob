These fixtures contain synthetic experience text for local import regression tests.

- experience.docx: generated with python-docx; Chinese paragraphs, English text, table, header and footer.
- experience.pdf: generated with ReportLab; two pages with Chinese CID font text and English text.
- mixed.pdf: the two-page PDF plus an empty third page, created with pypdf.
- image-only.pdf: one page containing a rectangle and no text, generated with ReportLab.
- encrypted.pdf: experience.pdf encrypted using the test password `fixture-secret` with pypdf.
- ocr-resume.png and ocr-resume.pdf: synthetic English resume text rendered into an image and an image-only PDF for local OCR checks.
- ocr-chinese.png: synthetic Chinese education, skills and employment headings with English skill names, for Chinese OCR and concurrent import checks.
- image-word.docx: synthetic Chinese body text with an embedded English resume image, for combined XML and OCR extraction.
- legacy.doc: upstream `test01.doc` from https://github.com/morungos/node-word-extractor/tree/develop/__tests__/data. Distributed under the accompanying legacy-LICENSE.txt (MIT).

No user profile, resume or contact data is included.
