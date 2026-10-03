import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddMakeModal } from '../components/makes/AddMakeModal';
import { DownloadSheet } from '../components/recipe-detail/DownloadSheet';
import { ImageZoomModal } from '../components/recipe-detail/ImageZoomModal';
import { IOSInstallModal } from '../components/layout/IOSInstallModal';
import { UI_TEXT } from '../i18n/translations';

const t = UI_TEXT.en;
const noop = () => {};

// aria-modal alone doesn't stop Tab: whatever a layer covers must be inert while it's open, so
// keyboard focus can't land on the page behind it. What comes after it (the toast's Undo) stays.
const behindAndAfter = (layer: React.ReactNode) => (
  <div>
    <main>
      <button type="button">Behind</button>
    </main>
    {layer}
    <button type="button">Undo</button>
  </div>
);

const expectCovered = () => {
  expect(screen.getByText('Behind').closest('[inert]')).not.toBeNull();
  expect(screen.getByText('Undo').closest('[inert]')).toBeNull();
};

describe('layers keep focus out of what they cover', () => {
  it('the make editor puts the app behind it out of reach, and lets go when closed', () => {
    const { rerender } = render(
      behindAndAfter(
        <AddMakeModal make={null} recipes={[]} language="en" onSave={noop} onClose={noop} t={t} />,
      ),
    );
    expectCovered();

    rerender(behindAndAfter(null));
    expect(screen.getByText('Behind').closest('[inert]')).toBeNull();
  });

  it("a sheet asked over the make editor puts the editor out of reach, but not the sheet's choices", () => {
    render(
      <AddMakeModal make={null} recipes={[]} language="en" onSave={noop} onClose={noop} t={t} />,
    );
    fireEvent.change(screen.getByLabelText(t.makeNote), { target: { value: 'Lovely' } });
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));

    expect(screen.getByLabelText(t.makeNote).closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('button', { name: t.save }).closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('button', { name: t.keepEditing }).closest('[inert]')).toBeNull();
    expect(document.activeElement).toHaveAccessibleName(t.keepEditing);
  });

  it('the download sheet puts the recipe page and island out of reach', () => {
    render(
      behindAndAfter(
        <DownloadSheet
          fileName="Babka.pdf"
          photo=""
          onChoose={() => Promise.resolve()}
          onClose={noop}
          t={t}
        />,
      ),
    );
    expectCovered();
  });

  it('the iOS install guide puts the app out of reach', () => {
    render(behindAndAfter(<IOSInstallModal onClose={noop} t={t} />));
    expectCovered();
  });

  it('an enlarged photo puts the page under it out of reach', () => {
    render(behindAndAfter(<ImageZoomModal imageSrc="x.jpg" onClose={noop} t={t} />));
    expectCovered();
  });
});
