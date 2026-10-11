import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {SafeMarkdown} from '../src/components/SafeMarkdown';
import CardForm from '../src/components/CardForm';

afterEach(cleanup);

describe('Markdown matches the donor light canvas', () => {
  it('pins standalone card, review and study previews to the light palette', () => {
    const {container} = render(<div data-color-mode="dark"><SafeMarkdown source={'# Question\n\nAnswer and `code`'}/></div>);
    const preview = container.querySelector('.wmde-markdown');
    expect(preview?.getAttribute('data-color-mode')).toBe('light');
    expect(preview?.querySelector('h1')?.textContent).toBe('Question');
    expect(preview?.querySelector('code')?.textContent).toBe('code');
  });

  it('pins both Markdown editor surfaces and previews to the same light palette', () => {
    const {container} = render(<div data-color-mode="dark"><CardForm initial={{front: 'Question', back: 'Answer'}} onSubmit={async () => {}}/></div>);
    const editors = container.querySelectorAll('.w-md-editor');
    const previews = container.querySelectorAll('.wmde-markdown');
    expect(editors).toHaveLength(2);
    expect(previews).toHaveLength(2);
    for (const element of [...editors, ...previews]) {
      expect(element.closest('[data-color-mode]')?.getAttribute('data-color-mode')).toBe('light');
    }
  });
});
