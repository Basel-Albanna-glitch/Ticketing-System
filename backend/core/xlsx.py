"""Shared .xlsx helpers.

Lifted out of reports so the to-do export can produce workbooks that look the same as
the ticket ones — two spreadsheets from the same product should not disagree about
whether a header row is bold.
"""
from openpyxl.utils import get_column_letter


def write_sheet(workbook, title, headers, rows, first=False):
    """Append one sheet of plain rows, sized to its headers."""
    # A fresh Workbook already has one empty sheet; the first write claims it rather than
    # leaving a stray "Sheet" tab in the download.
    sheet = workbook.active if first else workbook.create_sheet()
    sheet.title = title
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    for i, header in enumerate(headers, start=1):
        widest = max([len(str(header))] + [len(str(r[i - 1])) for r in rows] or [0])
        sheet.column_dimensions[get_column_letter(i)].width = min(50, max(12, widest + 2))
    return sheet
