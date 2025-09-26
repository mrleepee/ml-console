import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSelector, { EnhancedThemeSelector, SimpleThemeSelector } from './ThemeSelector';

// Mock the themeLoader module
jest.mock('../utils/themeLoader.js', () => ({
  getAllAvailableThemes: jest.fn(() => [
    { name: 'GitHub Dark', displayName: 'GitHub Dark', category: 'dark', id: 'github-dark' },
    { name: 'GitHub Light', displayName: 'GitHub Light', category: 'light', id: 'github-light' },
    { name: 'Night Owl', displayName: 'Night Owl', category: 'dark', id: 'night-owl' },
    { name: 'Dracula', displayName: 'Dracula', category: 'dark', id: 'dracula' },
    { name: 'Solarized-light', displayName: 'Solarized Light', category: 'light', id: 'solarized-light' }
  ]),
  getThemesByCategory: jest.fn(() => ({
    light: [
      { name: 'GitHub Light', displayName: 'GitHub Light', category: 'light', id: 'github-light' },
      { name: 'Solarized-light', displayName: 'Solarized Light', category: 'light', id: 'solarized-light' }
    ],
    dark: [
      { name: 'GitHub Dark', displayName: 'GitHub Dark', category: 'dark', id: 'github-dark' },
      { name: 'Night Owl', displayName: 'Night Owl', category: 'dark', id: 'night-owl' },
      { name: 'Dracula', displayName: 'Dracula', category: 'dark', id: 'dracula' }
    ],
    'high-contrast': []
  })),
  searchThemes: jest.fn((term) => {
    const allThemes = [
      { name: 'GitHub Dark', displayName: 'GitHub Dark', category: 'dark', id: 'github-dark' },
      { name: 'GitHub Light', displayName: 'GitHub Light', category: 'light', id: 'github-light' },
      { name: 'Night Owl', displayName: 'Night Owl', category: 'dark', id: 'night-owl' },
      { name: 'Dracula', displayName: 'Dracula', category: 'dark', id: 'dracula' },
      { name: 'Solarized-light', displayName: 'Solarized Light', category: 'light', id: 'solarized-light' }
    ];
    if (!term) return allThemes;
    return allThemes.filter(theme =>
      theme.displayName.toLowerCase().includes(term.toLowerCase())
    );
  }),
  THEME_CATEGORIES: {
    LIGHT: 'light',
    DARK: 'dark',
    HIGH_CONTRAST: 'high-contrast'
  },
  getThemeDisplayName: jest.fn(name => name || 'Unknown Theme')
}));

describe('ThemeSelector Components', () => {
  describe('SimpleThemeSelector', () => {
    test('renders basic theme dropdown', () => {
      const mockOnChange = jest.fn();
      render(
        <SimpleThemeSelector
          value="vs-dark"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('vs-dark');
    });

    test('includes built-in and popular themes', () => {
      const mockOnChange = jest.fn();
      render(
        <SimpleThemeSelector
          value="vs"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Light (Visual Studio)')).toBeInTheDocument();
      expect(screen.getByText('Dark (Visual Studio Dark)')).toBeInTheDocument();
      expect(screen.getByText('GitHub Dark')).toBeInTheDocument();
      expect(screen.getByText('Night Owl')).toBeInTheDocument();
      expect(screen.getByText('Dracula')).toBeInTheDocument();
    });

    test('calls onChange when selection changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(
        <SimpleThemeSelector
          value="vs"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'GitHub Dark');

      expect(mockOnChange).toHaveBeenCalledWith('GitHub Dark');
    });

    test('can be disabled', () => {
      const mockOnChange = jest.fn();
      render(
        <SimpleThemeSelector
          value="vs"
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('EnhancedThemeSelector', () => {
    const defaultProps = {
      value: 'GitHub Dark',
      onChange: jest.fn(),
      showBuiltInThemes: true
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('displays current theme selection', () => {
      render(<EnhancedThemeSelector {...defaultProps} />);

      expect(screen.getByText('GitHub Dark')).toBeInTheDocument();
    });

    test('opens dropdown when clicked', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByPlaceholderText('Search themes...')).toBeInTheDocument();
      expect(screen.getByText('Night Owl')).toBeInTheDocument();
      expect(screen.getByText('Dracula')).toBeInTheDocument();
    });

    test('filters themes by search term', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const searchInput = screen.getByPlaceholderText('Search themes...');
      await user.type(searchInput, 'GitHub');

      expect(screen.getByText('GitHub Light')).toBeInTheDocument();
      expect(screen.queryByText('Night Owl')).not.toBeInTheDocument();
      expect(screen.queryByText('Dracula')).not.toBeInTheDocument();
    });

    test('filters themes by category', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const categorySelect = screen.getByDisplayValue(/All Themes/);
      await user.selectOptions(categorySelect, 'light');

      expect(screen.getByText('GitHub Light')).toBeInTheDocument();
      expect(screen.getByText('Solarized Light')).toBeInTheDocument();
      expect(screen.queryByText('GitHub Dark')).not.toBeInTheDocument();
      expect(screen.queryByText('Night Owl')).not.toBeInTheDocument();
    });

    test('shows theme count in category filter', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByText(/All Themes \(7\)/)).toBeInTheDocument(); // 4 built-in + 5 custom - 2 for light category shown separately
      expect(screen.getByText(/Built-in Themes \(4\)/)).toBeInTheDocument();
      expect(screen.getByText(/Light \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Dark \(3\)/)).toBeInTheDocument();
    });

    test('displays "No themes found" when search yields no results', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const searchInput = screen.getByPlaceholderText('Search themes...');
      await user.type(searchInput, 'nonexistenttheme');

      expect(screen.getByText('No themes found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filter')).toBeInTheDocument();
    });

    test('selects theme and closes dropdown', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(<EnhancedThemeSelector {...defaultProps} onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const nightOwlButton = screen.getByText('Night Owl');
      await user.click(nightOwlButton);

      expect(mockOnChange).toHaveBeenCalledWith('Night Owl');

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search themes...')).not.toBeInTheDocument();
      });
    });

    test('shows checkmark for selected theme', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      // Look for the selected theme button
      const selectedThemeButton = screen.getByRole('button', { name: /GitHub Dark/ });
      expect(selectedThemeButton).toHaveClass('bg-primary');

      // Check for checkmark icon (SVG)
      const checkmark = selectedThemeButton.querySelector('svg');
      expect(checkmark).toBeInTheDocument();
    });

    test('closes dropdown on escape key', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByPlaceholderText('Search themes...')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search themes...')).not.toBeInTheDocument();
      });
    });

    test('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <EnhancedThemeSelector {...defaultProps} />
          <div data-testid="outside">Outside element</div>
        </div>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByPlaceholderText('Search themes...')).toBeInTheDocument();

      const outsideElement = screen.getByTestId('outside');
      await user.click(outsideElement);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search themes...')).not.toBeInTheDocument();
      });
    });

    test('can hide built-in themes', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector {...defaultProps} showBuiltInThemes={false} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.queryByText('Built-in Themes')).not.toBeInTheDocument();
      expect(screen.queryByText('Light (Visual Studio)')).not.toBeInTheDocument();
    });

    test('handles disabled state', () => {
      render(<EnhancedThemeSelector {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    test('handles empty value gracefully', () => {
      render(<EnhancedThemeSelector {...defaultProps} value="" />);

      expect(screen.getByText('Select a theme...')).toBeInTheDocument();
    });

    test('clears search when theme is selected', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(<EnhancedThemeSelector {...defaultProps} onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const searchInput = screen.getByPlaceholderText('Search themes...');
      await user.type(searchInput, 'GitHub');

      const githubLightButton = screen.getByText('GitHub Light');
      await user.click(githubLightButton);

      expect(mockOnChange).toHaveBeenCalledWith('GitHub Light');
    });
  });

  describe('ThemeSelector (Main Component)', () => {
    const MockMonacoEditor = ({ content, theme }) => (
      <div data-testid="monaco-editor" data-theme={theme}>
        {content}
      </div>
    );

    test('renders toggle variant', () => {
      render(
        <ThemeSelector
          variant="toggle"
          theme="light"
          onThemeChange={jest.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('🌙');
      expect(button).toHaveAttribute('title', 'Switch to dark mode');
    });

    test('renders full variant with all components', () => {
      render(
        <ThemeSelector
          variant="full"
          theme="light"
          onThemeChange={jest.fn()}
          monacoTheme="vs"
          onMonacoThemeChange={jest.fn()}
          MonacoEditor={MockMonacoEditor}
        />
      );

      expect(screen.getByText('Application Theme')).toBeInTheDocument();
      expect(screen.getByText('Monaco Editor Theme')).toBeInTheDocument();
      expect(screen.getByText('Theme Preview')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    test('toggles application theme', async () => {
      const user = userEvent.setup();
      const mockOnThemeChange = jest.fn();

      render(
        <ThemeSelector
          variant="toggle"
          theme="light"
          onThemeChange={mockOnThemeChange}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnThemeChange).toHaveBeenCalledWith('dark');
    });

    test('shows current application theme in full variant', () => {
      render(
        <ThemeSelector
          variant="full"
          theme="dark"
          onThemeChange={jest.fn()}
          monacoTheme="vs-dark"
          onMonacoThemeChange={jest.fn()}
        />
      );

      expect(screen.getByText('Current: Dark')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveTextContent('☀️');
    });

    test('changes Monaco theme', async () => {
      const user = userEvent.setup();
      const mockOnMonacoThemeChange = jest.fn();

      render(
        <ThemeSelector
          variant="full"
          theme="light"
          onThemeChange={jest.fn()}
          monacoTheme="vs"
          onMonacoThemeChange={mockOnMonacoThemeChange}
          MonacoEditor={MockMonacoEditor}
        />
      );

      // Open the enhanced theme selector
      const themeButton = screen.getByText('Light (Visual Studio)');
      await user.click(themeButton);

      // Select a different theme
      const nightOwlButton = screen.getByText('Night Owl');
      await user.click(nightOwlButton);

      expect(mockOnMonacoThemeChange).toHaveBeenCalledWith('Night Owl');
    });

    test('renders Monaco preview with current theme', () => {
      render(
        <ThemeSelector
          variant="full"
          theme="light"
          onThemeChange={jest.fn()}
          monacoTheme="GitHub Dark"
          onMonacoThemeChange={jest.fn()}
          MonacoEditor={MockMonacoEditor}
        />
      );

      const monacoEditor = screen.getByTestId('monaco-editor');
      expect(monacoEditor).toHaveAttribute('data-theme', 'GitHub Dark');
      expect(monacoEditor).toHaveTextContent('Monaco Editor Theme Preview');
    });

    test('does not render preview without MonacoEditor prop', () => {
      render(
        <ThemeSelector
          variant="full"
          theme="light"
          onThemeChange={jest.fn()}
          monacoTheme="vs"
          onMonacoThemeChange={jest.fn()}
        />
      );

      expect(screen.queryByText('Theme Preview')).not.toBeInTheDocument();
    });

    test('includes enhanced description for Monaco themes', () => {
      render(
        <ThemeSelector
          variant="full"
          theme="light"
          onThemeChange={jest.fn()}
          monacoTheme="vs"
          onMonacoThemeChange={jest.fn()}
        />
      );

      expect(screen.getByText('Choose from 55+ professional themes for code editors')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA attributes', () => {
      render(<EnhancedThemeSelector value="GitHub Dark" onChange={jest.fn()} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('updates aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector value="GitHub Dark" onChange={jest.fn()} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('search input receives focus when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<EnhancedThemeSelector value="GitHub Dark" onChange={jest.fn()} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const searchInput = screen.getByPlaceholderText('Search themes...');
      expect(searchInput).toHaveFocus();
    });

    test('toggle button has proper aria-label', () => {
      render(
        <ThemeSelector
          variant="toggle"
          theme="light"
          onThemeChange={jest.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    });
  });
});