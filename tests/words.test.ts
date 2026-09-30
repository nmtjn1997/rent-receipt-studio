import { describe, expect, it } from 'vitest';
import { amountToWords, inr, integerToWords } from '../src/lib/words';

describe('amountToWords', () => {
  it('spells the sample amount without the doubled "Only"', () => {
    expect(amountToWords(33333)).toBe('Rupees Thirty Three Thousand Three Hundred Thirty Three Only');
  });
  it('uses lakh and crore', () => {
    expect(integerToWords(100000)).toBe('One Lakh');
    expect(integerToWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    expect(integerToWords(10000000)).toBe('One Crore');
  });
  it('handles the rents in our agreements', () => {
    expect(amountToWords(66000)).toBe('Rupees Sixty Six Thousand Only');
    expect(amountToWords(72600)).toBe('Rupees Seventy Two Thousand Six Hundred Only');
  });
  it('handles zero, teens and paise', () => {
    expect(integerToWords(0)).toBe('Zero');
    expect(integerToWords(15015)).toBe('Fifteen Thousand Fifteen');
    expect(amountToWords(1500.5)).toBe('Rupees One Thousand Five Hundred and Fifty Paise Only');
  });
  it('rejects negatives', () => {
    expect(() => integerToWords(-1)).toThrow();
  });
});

describe('inr', () => {
  it('groups digits the Indian way', () => {
    expect(inr(999)).toBe('999');
    expect(inr(72600)).toBe('72,600');
    expect(inr(1234567)).toBe('12,34,567');
    expect(inr(12345.5)).toBe('12,345.50');
  });
});
