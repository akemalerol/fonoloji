import { describe, expect, it } from 'vitest';
import { parseHistoryApiResponse } from '../src/parsers/jsonParser.js';

describe('parseHistoryApiResponse', () => {
  it('parses Apify-style JSON response with ASP.NET date', () => {
    const body = JSON.stringify({
      draw: 1,
      recordsTotal: 2,
      recordsFiltered: 2,
      data: [
        {
          TARIH: '/Date(1718409600000)/',
          FONKODU: 'TTE',
          FONUNVAN: 'TEB PORTFÖY HİSSE SENEDİ FONU',
          FIYAT: 3.456789,
          TEDPAYSAYISI: 357246813,
          KISISAYISI: 12450,
          PORTFOYBUYUKLUGU: 1234567890.5,
        },
        {
          TARIH: 1718323200000,
          FONKODU: 'AFT',
          FONUNVAN: 'AK PORTFÖY',
          FIYAT: 1.234,
          TEDPAYSAYISI: 100000,
          KISISAYISI: 500,
          PORTFOYBUYUKLUGU: 123400,
        },
      ],
    });

    const rows = parseHistoryApiResponse(body);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.date).toBe('2024-06-15');
    expect(rows[0]!.fundCode).toBe('TTE');
    expect(rows[0]!.price).toBeCloseTo(3.456789, 6);
    expect(rows[1]!.date).toBe('2024-06-14');
  });

  it('accepts DD.MM.YYYY string dates', () => {
    const body = JSON.stringify({
      data: [
        {
          TARIH: '15.06.2024',
          FONKODU: 'TTE',
          FONUNVAN: 'X',
          FIYAT: '3,4567',
          TEDPAYSAYISI: '100',
          KISISAYISI: '10',
          PORTFOYBUYUKLUGU: '1000',
        },
      ],
    });
    const rows = parseHistoryApiResponse(body);
    expect(rows[0]!.date).toBe('2024-06-15');
    expect(rows[0]!.price).toBeCloseTo(3.4567, 4);
  });

  it('returns empty array for empty/invalid input', () => {
    expect(parseHistoryApiResponse('')).toEqual([]);
    expect(parseHistoryApiResponse('not json')).toEqual([]);
    expect(parseHistoryApiResponse('{"data":[]}')).toEqual([]);
    expect(parseHistoryApiResponse('{}')).toEqual([]);
  });

  it('skips rows missing required fields', () => {
    const body = JSON.stringify({
      data: [
        { TARIH: '15.06.2024', FONKODU: '' },
        { FONKODU: 'TTE' },
        {
          TARIH: '15.06.2024',
          FONKODU: 'TTE',
          FONUNVAN: 'X',
          FIYAT: 1,
          TEDPAYSAYISI: 1,
          KISISAYISI: 1,
          PORTFOYBUYUKLUGU: 1,
        },
      ],
    });
    const rows = parseHistoryApiResponse(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fundCode).toBe('TTE');
  });

  it('investorCount is integer', () => {
    const body = JSON.stringify({
      data: [
        {
          TARIH: '15.06.2024',
          FONKODU: 'TTE',
          FONUNVAN: 'X',
          FIYAT: 1,
          TEDPAYSAYISI: 1,
          KISISAYISI: 12450.7,
          PORTFOYBUYUKLUGU: 1,
        },
      ],
    });
    const rows = parseHistoryApiResponse(body);
    expect(rows[0]!.investorCount).toBe(12450);
    expect(Number.isInteger(rows[0]!.investorCount)).toBe(true);
  });
});
