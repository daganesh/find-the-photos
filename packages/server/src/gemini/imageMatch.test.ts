import { describe, it, expect } from 'vitest';
import { parseVerdict } from './imageMatch.js';

describe('parseVerdict', () => {
  it('parses clean JSON', () => {
    const v = parseVerdict('{"match": true, "confidence": 0.9, "reason": "Same bench!"}');
    expect(v).toEqual({ match: true, confidence: 0.9, reason: 'Same bench!' });
  });

  it('tolerates code fences and prose around the JSON', () => {
    const v = parseVerdict('Sure!\n```json\n{"match": false, "confidence": 0.3, "reason": "Different."}\n```');
    expect(v.match).toBe(false);
    expect(v.reason).toBe('Different.');
  });

  it('clamps confidence to 0..1', () => {
    expect(parseVerdict('{"match": true, "confidence": 5, "reason": "x"}').confidence).toBe(1);
    expect(parseVerdict('{"match": true, "confidence": -2, "reason": "x"}').confidence).toBe(0);
  });

  it('falls back safely on garbage', () => {
    const v = parseVerdict('not json at all');
    expect(v.match).toBe(false);
    expect(v.confidence).toBe(0);
  });
});
