// Amount in words, Indian numbering (Crore / Lakh / Thousand) with paise. Display-only,
// used by the HAL payment documents — the figure itself always comes from the server.
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');

function threeDigits(n) {
  const parts = [];
  if (Math.floor(n / 100)) parts.push(ONES[Math.floor(n / 100)] + ' Hundred');
  if (n % 100) parts.push(twoDigits(n % 100));
  return parts.join(' ');
}

function indianWords(num) {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  const parts = [];
  if (crore) parts.push(indianWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function amountInWords(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const v = Math.round(Number(value) * 100) / 100;
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  let s = indianWords(rupees);
  if (paise > 0) s += ' And ' + twoDigits(paise) + ' Paise';
  return s + ' Only';
}
