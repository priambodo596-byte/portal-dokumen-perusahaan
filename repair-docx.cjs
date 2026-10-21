const fs = require('fs');
const JSZip = require('jszip');
(async () => {
  const input = 'B:/Template-Surat-Undangan.docx';
  const output = 'B:/Template-Surat-Undangan-fixed.docx';
  const zip = await JSZip.loadAsync(fs.readFileSync(input));
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('word/document.xml tidak ditemukan');
  let xml = await part.async('string');
  const match = xml.match(/<w:body([^>]*)>(\s*)(<w:sectPr\b[\s\S]*?<\/w:sectPr>)/);
  if (match) {
    const section = match[3];
    xml = xml.replace(match[0], '<w:body' + match[1] + '>' + match[2]);
    xml = xml.replace('</w:body>', section + '</w:body>');
  }
  xml = xml.replace(/\s+[\w:.-]+="undefined"/g, '');
  zip.file('word/document.xml', xml);
  const buffer = await zip.generateAsync({type:'nodebuffer', compression:'DEFLATE'});
  fs.writeFileSync(output, buffer);
  console.log('Created: ' + output + ' (' + buffer.length + ' bytes)');
})();
