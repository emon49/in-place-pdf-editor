// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StyleControls } from '../../../src/components/StyleControls';
import type { TextStyle } from '../../../src/types/operations';

afterEach(cleanup);

const BASE_STYLE: TextStyle = {
  fontClass: 'sans',
  bold: false,
  italic: false,
  fontFamilyOverride: null,
  size: 12,
  color: '#000000',
  charSpacing: 0,
  wordSpacing: 0,
  lineHeight: 1.2,
  hScale: 100,
  rise: 0,
  renderMode: 0,
};

describe('StyleControls (9.2)', () => {
  it('renders font family selector, size controls, bold, italic, color picker', () => {
    render(<StyleControls style={BASE_STYLE} onChange={() => {}} />);
    expect(screen.getByTestId('style-font-family')).toBeTruthy();
    expect(screen.getByTestId('style-font-size')).toBeTruthy();
    expect(screen.getByTestId('style-size-up')).toBeTruthy();
    expect(screen.getByTestId('style-size-down')).toBeTruthy();
    expect(screen.getByTestId('style-bold')).toBeTruthy();
    expect(screen.getByTestId('style-italic')).toBeTruthy();
    expect(screen.getByTestId('style-color')).toBeTruthy();
  });

  it('selecting a font family calls onChange with fontFamilyOverride', () => {
    const onChange = vi.fn();
    render(<StyleControls style={BASE_STYLE} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('style-font-family'), { target: { value: 'Roboto' } });
    expect(onChange).toHaveBeenCalledWith({ fontFamilyOverride: 'Roboto' });
  });

  it('selecting Original font calls onChange with null fontFamilyOverride', () => {
    const onChange = vi.fn();
    const style = { ...BASE_STYLE, fontFamilyOverride: 'Roboto' };
    render(<StyleControls style={style} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('style-font-family'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ fontFamilyOverride: null });
  });

  it('size up button calls onChange with incremented size', () => {
    const onChange = vi.fn();
    render(<StyleControls style={BASE_STYLE} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('style-size-up'));
    expect(onChange).toHaveBeenCalledWith({ size: 13 });
  });

  it('size down button calls onChange with decremented size', () => {
    const onChange = vi.fn();
    render(<StyleControls style={BASE_STYLE} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('style-size-down'));
    expect(onChange).toHaveBeenCalledWith({ size: 11 });
  });

  it('bold toggle calls onChange with toggled bold', () => {
    const onChange = vi.fn();
    render(<StyleControls style={BASE_STYLE} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('style-bold'));
    expect(onChange).toHaveBeenCalledWith({ bold: true });
  });

  it('italic toggle calls onChange with toggled italic', () => {
    const onChange = vi.fn();
    render(<StyleControls style={BASE_STYLE} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('style-italic'));
    expect(onChange).toHaveBeenCalledWith({ italic: true });
  });
});
