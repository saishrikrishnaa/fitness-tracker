import { COLORS } from '../constants/theme';

describe('Theme Constants', () => {
  it('defines the core dark mode colors', () => {
    expect(COLORS.background).toBe('#0D0D0D');
    expect(COLORS.card).toBe('rgba(26, 26, 26, 0.7)');
    expect(COLORS.primary).toBe('#06B6D4');
    expect(COLORS.secondary).toBe('#4F46E5');
  });
});
