import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepBuilder, StepBuilderItem } from '../components/recipe-form/StepBuilder';
import { UI_TEXT } from '../i18n/translations';

const t = UI_TEXT.en;
const step = (id: string, text: string): StepBuilderItem => ({
  id,
  text,
  notes: '',
  imageSrc: '',
  imageCaption: '',
});

describe('StepBuilder', () => {
  it('removes the chosen step when several exist', () => {
    const onChange = vi.fn();
    render(<StepBuilder steps={[step('a', 'Mix'), step('b', 'Bake')]} onChange={onChange} t={t} />);

    fireEvent.click(screen.getByLabelText(`${t.removeStep} 1`));

    expect(onChange).toHaveBeenCalledWith([step('b', 'Bake')]);
  });

  it('resets to one fresh empty step when removing the last step', () => {
    const onChange = vi.fn();
    render(<StepBuilder steps={[step('a', 'Mix')]} onChange={onChange} t={t} />);

    fireEvent.click(screen.getByLabelText(`${t.removeStep} 1`));

    const [[next]] = onChange.mock.calls;
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: '', notes: '', imageSrc: '', imageCaption: '' });
    expect(next[0].id).toMatch(/^step-\d+-[a-z0-9]+$/);
    expect(next[0].id).not.toBe('a');
  });

  it('adds a step with a unique id', () => {
    const onChange = vi.fn();
    render(<StepBuilder steps={[step('a', 'Mix')]} onChange={onChange} t={t} />);

    fireEvent.click(screen.getByText(t.addStep, { exact: false }));

    const [[next]] = onChange.mock.calls;
    expect(next).toHaveLength(2);
    expect(next[1].id).toMatch(/^step-\d+-[a-z0-9]+$/);
  });
});
