import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/language-context';
import { KeybindingProvider } from '../../contexts/keybinding-context';
import { ListView } from './ListView';

describe('ListView', () => {
  it('renders the view title', () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <KeybindingProvider currentView="inbox" onNavigate={() => {}}>
          <ListView title="Inbox" statusFilter="inbox" />
        </KeybindingProvider>
      </LanguageProvider>
    );
    expect(html).toContain('Inbox');
  });

  it('does not render local search input in inbox view', () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <KeybindingProvider currentView="inbox" onNavigate={() => {}}>
          <ListView title="Inbox" statusFilter="inbox" />
        </KeybindingProvider>
      </LanguageProvider>
    );
    expect(html).not.toContain('data-view-filter-input');
  });

  it('renders local search input in done view', () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <KeybindingProvider currentView="done" onNavigate={() => {}}>
          <ListView title="Done" statusFilter="done" />
        </KeybindingProvider>
      </LanguageProvider>
    );
    expect(html).toContain('data-view-filter-input');
  });
});
