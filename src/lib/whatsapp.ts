export const openWhatsApp = async (phone: string, message: string) => {
  const encoded = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise<void>((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error('copy-failed'));
      } catch (err) { reject(err); }
    });
  };

  try {
    if (isMobile) {
      const native = `whatsapp://send?phone=${phone}&text=${encoded}`;
      window.location.href = native;
      return { opened: true };
    } else {
      const web = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
      const w = window.open(web, '_blank');
      if (w) return { opened: true };
      return { opened: false, copied: await copyToClipboard(message) };
    }
  } catch (err) {
    try { await copyToClipboard(message); return { opened: false, copied: true }; }
    catch (e) { return { opened: false, copied: false }; }
  }
};

export const downloadVCard = (phone: string, name = 'Contact') => {
  const tel = phone.startsWith('+') ? phone : `+${phone}`;
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=WORK,VOICE:${tel}\nORG:${name}\nEND:VCARD`;
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default openWhatsApp;
