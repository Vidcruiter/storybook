import type { Meta, StoryObj } from '@storybook/html';
import type { HeaderProps } from './Header';
import { createHeader } from './Header';

const meta: Meta<HeaderProps> = {
  title: 'Example/Header',
  // This component will have an automatically generated docsPage entry: https://storybook.js.org/docs/html/writing-docs/docs-page
  tags: ['docsPage'],
  render: (args) => createHeader(args),
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/html/configure/story-layout
    layout: 'fullscreen',
  },
  // More on argTypes: https://storybook.js.org/docs/html/api/argtypes
  argTypes: {
    onLogin: { action: 'onLogin' },
    onLogout: { action: 'onLogout' },
    onCreateAccount: { action: 'onCreateAccount' },
  },
};

export default meta;
type Story = StoryObj<HeaderProps>;

export const LoggedIn: Story = {
  args: {
    user: {
      name: 'John Doe',
    },
  },
};

export const LoggedOut: Story = {};
