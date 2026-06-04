import os
import re
import xml.etree.ElementTree as ET
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute total pages and draw footer page numbers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header text
        self.drawString(54, 750, "SRE AI Incident Management Agent - Project Deep Dive Analysis")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Footer text
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_text)
        self.drawString(54, 40, "CONFIDENTIAL - FOR SEMINAR & AUDIT PURPOSES ONLY")
        self.line(54, 52, 558, 52)
        
        self.restoreState()


def is_valid_xml(xml_string):
    try:
        ET.fromstring(f"<root>{xml_string}</root>")
        return True
    except Exception:
        return False


def parse_inline_markdown(text):
    """
    Converts bold, italics, code, and links to ReportLab HTML-like tags.
    Falls back to escaped plain text if the XML tags are malformed or mismatched.
    """
    # Escapes
    escaped_plain = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    try:
        rich = escaped_plain
        # Bold: **text** -> <b>text</b>
        rich = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', rich)
        
        # Italics: *text* -> <i>text</i> (using word-bound matching to avoid wildcard collisions)
        rich = re.sub(r'\*(?=\S)(.+?)(?<=\S)\*', r'<i>\1</i>', rich)
        
        # Code: `code` -> <font face="Courier" color="#9C338A"><b>\1</b></font>
        rich = re.sub(r'`(.*?)`', r'<font face="Courier" size="8.5" color="#9C338A"><b>\1</b></font>', rich)
        
        # Links: [text](link) -> <font color="#8B5CF6"><u>\1</u></font>
        rich = re.sub(r'\[(.*?)\]\((.*?)\)', r'<font color="#8B5CF6"><u>\1</u></font>', rich)
        
        if is_valid_xml(rich):
            return rich
    except Exception:
        pass
        
    return escaped_plain


def build_pdf(md_path, pdf_path):
    # Load styles
    styles = getSampleStyleSheet()
    
    # Custom colors
    color_primary = colors.HexColor("#0B1020")
    color_text = colors.HexColor("#1E293B")
    color_code_bg = colors.HexColor("#F8FAFC")
    
    # Base text styles
    style_body = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=color_text,
        spaceAfter=6
    )
    
    style_h1 = ParagraphStyle(
        'CustomH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    style_h2 = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    style_h3 = ParagraphStyle(
        'CustomH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    style_list = ParagraphStyle(
        'CustomList',
        parent=style_body,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    style_code = ParagraphStyle(
        'CustomCode',
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
        backColor=color_code_bg,
        borderColor=colors.HexColor("#E2E8F0"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=8
    )

    style_table_cell = ParagraphStyle(
        'CustomTableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=color_text
    )

    style_table_header = ParagraphStyle(
        'CustomTableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    story = []
    
    # Title block
    title_p = Paragraph("<font size='22' color='#5B21B6'><b>Project Deep Dive Analysis Document</b></font>", style_h1)
    subtitle_p = Paragraph("<font size='12' color='#64748B'>AI-Powered SRE Incident Management and Diagnostics Platform</font>", style_body)
    story.append(title_p)
    story.append(subtitle_p)
    story.append(Spacer(1, 15))

    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    
    in_code_block = False
    code_lines = []
    
    in_table = False
    table_rows = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # 1. Handle Code Blocks
        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                code_text = "\n".join(code_lines)
                story.append(Preformatted(code_text, style_code))
                story.append(Spacer(1, 4))
            i += 1
            continue

        if in_code_block:
            # Escape HTML-like characters inside code blocks to avoid ReportLab parser failures
            escaped_code_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            code_lines.append(escaped_code_line)
            i += 1
            continue
            
        # 2. Handle Tables
        if line.strip().startswith('|'):
            if not in_table:
                in_table = True
                table_rows = []
            
            # Skip delimiter line like |---|---|
            if '---' in line:
                i += 1
                continue
                
            cells = [c.strip() for c in line.split('|')[1:-1]]
            table_rows.append(cells)
            i += 1
            continue
        else:
            if in_table:
                # Compile table
                in_table = False
                if table_rows:
                    formatted_data = []
                    # Row style tracker
                    for r_idx, row in enumerate(table_rows):
                        formatted_row = []
                        for cell in row:
                            cell_text = parse_inline_markdown(cell)
                            if r_idx == 0:
                                formatted_row.append(Paragraph(cell_text, style_table_header))
                            else:
                                formatted_row.append(Paragraph(cell_text, style_table_cell))
                        formatted_data.append(formatted_row)
                    
                    # Columns width calculations (equally distributed or based on content)
                    num_cols = len(table_rows[0])
                    available_width = doc.width
                    col_width = available_width / num_cols
                    
                    t = Table(formatted_data, colWidths=[col_width]*num_cols)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4C1D95")), # Dark purple header
                        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                        ('VALIGN', (0,0), (-1,-1), 'TOP'),
                        ('TOPPADDING', (0,0), (-1,-1), 4),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ('LEFTPADDING', (0,0), (-1,-1), 4),
                        ('RIGHTPADDING', (0,0), (-1,-1), 4),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ]))
                    story.append(t)
                    story.append(Spacer(1, 8))
                table_rows = []
                # Don't skip processing the current non-table line
                
        # 3. Headings
        if line.startswith('# '):
            text = parse_inline_markdown(line[2:])
            story.append(Paragraph(text, style_h1))
            story.append(Spacer(1, 4))
        elif line.startswith('## '):
            text = parse_inline_markdown(line[3:])
            story.append(Paragraph(text, style_h2))
            story.append(Spacer(1, 4))
        elif line.startswith('### '):
            text = parse_inline_markdown(line[4:])
            story.append(Paragraph(text, style_h3))
            story.append(Spacer(1, 4))
            
        # 4. Bullet lists
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            bullet_char = "&bull; "
            clean_line = line.strip()[2:]
            text = bullet_char + parse_inline_markdown(clean_line)
            story.append(Paragraph(text, style_list))
            
        # 5. Page breaks
        elif line.strip() == '---' or line.strip() == '***':
            story.append(PageBreak())
            
        # 6. Normal Paragraph
        elif line.strip():
            text = parse_inline_markdown(line)
            story.append(Paragraph(text, style_body))
            
        i += 1

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF built successfully: {pdf_path}")


if __name__ == '__main__':
    md_file = "project_technical_analysis.md"
    pdf_file = "project_technical_analysis.pdf"
    build_pdf(md_file, pdf_file)
