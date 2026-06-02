/**
 * SRE Command Center Report Export Utility.
 * Compiles incident and RCA document states into actual client-side downloads (PDF and JSON).
 */

export const downloadJsonReport = (incident: any, rca?: any) => {
  const payload = {
    incident_id: incident.id,
    metadata: {
      severity: incident.severity,
      services: incident.services_affected,
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      resolved_by: incident.resolved_by || 'operator',
      resolved_at: incident.resolved_at || incident.updated_at,
    },
    timeline: incident.timeline,
    hypotheses: incident.hypotheses,
    rca_document: rca || null
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `Incident-RCA-${incident.id.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadPdfReport = (incident: any, rcaContent?: string) => {
  const lines = [
    `AI INCIDENT COMMAND CENTER - POST-MORTEM REPORT`,
    `================================================`,
    `Incident ID:  ${incident.id}`,
    `Severity:     ${incident.severity.toUpperCase()}`,
    `State:        ${incident.state.toUpperCase()}`,
    `Services:     ${incident.services_affected.join(', ')}`,
    `Created At:   ${new Date(incident.created_at).toLocaleString()}`,
    `Updated At:   ${new Date(incident.updated_at).toLocaleString()}`,
    `Resolved By:  ${incident.resolved_by || 'Operator Prakash'}`,
    ``,
    `TIMELINE EVENTS LOG`,
    `-------------------`,
    ...incident.timeline.map((t: any) => 
      `[${new Date(t.timestamp).toLocaleTimeString()}] (${t.event_type.toUpperCase()}) ${t.message}`
    ),
    ``,
    `AI DIAGNOSTIC HYPOTHESES`,
    `------------------------`,
    ...incident.hypotheses.map((h: any) => 
      `Rank ${h.rank} (${Math.round(h.confidence_score * 100)}% Conf): ${h.hypothesis}\n  Recommended Action: ${h.recommended_action}`
    ),
  ];

  if (rcaContent) {
    lines.push(
      ``,
      `ROOT CAUSE ANALYSIS DOCUMENT`,
      `----------------------------`,
      rcaContent
    );
  }

  // Generate standard %PDF-1.4 binary buffer
  const pdfBytes = generateSimplePDF(lines);
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Incident-PostMortem-${incident.id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function generateSimplePDF(lines: string[]): Uint8Array {
  // Safe ASCII map and escape characters for PDF strings
  const escapedLines = lines.map(line => {
    return line
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x00-\x7F]/g, ''); // Strip non-ASCII
  });

  // Flat text stream mappings for PDF
  const textStream = escapedLines.map(line => `(${line}) Tj T*`).join('\n');
  
  const contentStream = `BT\n/F1 10 Tf\n12 TL\n50 800 Td\n${textStream}\nET`;
  const streamLength = contentStream.length;
  
  const objects: string[] = [];
  objects.push(`%PDF-1.4\n`); // Header
  
  // PDF Document catalog structure
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >> /Contents 4 0 R >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  // Offset trackers
  let currentOffset = 0;
  const offsets: number[] = [];
  
  const encoder = new TextEncoder();
  const objBuffers = objects.map((obj, index) => {
    const bytes = encoder.encode(obj);
    if (index > 0) {
      offsets.push(currentOffset);
    }
    currentOffset += bytes.length;
    return bytes;
  });

  const xrefStart = currentOffset;
  let xref = `xref\n0 5\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    xref += `${padded} 00000 n \n`;
  }
  
  xref += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const xrefBytes = encoder.encode(xref);
  
  const totalLength = currentOffset + xrefBytes.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const buf of objBuffers) {
    result.set(buf, pos);
    pos += buf.length;
  }
  result.set(xrefBytes, pos);
  
  return result;
}
