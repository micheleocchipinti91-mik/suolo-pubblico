// pdf.js — Generazione PDF con jsPDF (sostituisce PDFKit su Node)

async function generaPDFRiepilogo(anno, occupazioni) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(18).setTextColor(26, 54, 93);
  doc.text('ATM Spa — Gestione Suolo Pubblico', 14, 16);
  doc.setFontSize(12).setTextColor(74, 85, 104);
  doc.text(`Riepilogo Anno ${anno}`, 14, 24);
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 14, 30);

  // Linea separatrice
  doc.setDrawColor(203, 213, 224);
  doc.line(14, 33, 283, 33);

  const rows = occupazioni.map(o => [
    o.ditta.ragioneSociale || '',
    o.ditta.ubicazione ? `${o.ditta.ubicazione}, ${o.ditta.civico}` : '',
    String(o.stalli.numero || ''),
    o.stalli.settore || '',
    o.stalli.tariffazione || '',
    o.periodo.annuale ? 'Annuale' : o.periodo.stagionale ? 'Stagionale' : '',
    o.periodo.dataInizio && o.periodo.dataFine
      ? `${formatData(o.periodo.dataInizio)} - ${formatData(o.periodo.dataFine)}`
      : '',
    o.pagamento.stato === 'pagato' ? 'Pagato'
      : o.pagamento.stato === 'parziale' ? 'Parziale'
      : 'Non Pagato',
    o.avvisato && o.avvisato.length > 0 ? o.avvisato.map(formatData).join(', ') : '-',
    o.note || ''
  ]);

  doc.autoTable({
    head: [['Ditta', 'Ubicazione', 'Stalli', 'Sett.', 'Tariffazione', 'Periodo', 'Date', 'Pagamento', 'Avvisi', 'Note']],
    body: rows,
    startY: 37,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 54, 93], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 28 },
      5: { cellWidth: 22 },
      6: { cellWidth: 30 },
      7: { cellWidth: 22 },
      8: { cellWidth: 30 },
      9: { cellWidth: 'auto' }
    },
    alternateRowStyles: { fillColor: [247, 250, 252] },
    didParseCell: function (data) {
      if (data.column.index === 7) {
        if (data.cell.raw === 'Pagato') data.cell.styles.textColor = [34, 197, 94];
        else if (data.cell.raw === 'Parziale') data.cell.styles.textColor = [249, 115, 22];
        else if (data.cell.raw === 'Non Pagato') data.cell.styles.textColor = [239, 68, 68];
      }
    }
  });

  // Piè di pagina
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(160, 174, 192);
    doc.text(`Pagina ${i} di ${totalPages}`, 283, 200, { align: 'right' });
    doc.text('ATM Spa — Gestione Suolo Pubblico', 14, 200);
  }

  doc.save(`riepilogo_suolo_pubblico_${anno}.pdf`);
}

function formatData(d) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

window.generaPDFRiepilogo = generaPDFRiepilogo;
