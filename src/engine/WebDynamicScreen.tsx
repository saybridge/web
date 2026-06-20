import { UIScreen } from './types';
import { WebDynamicRenderer } from './WebDynamicRenderer';
import { PageContainer } from '@saybridge/ui';
import './WebDynamicScreen.css';

interface WebDynamicScreenProps {
  screen: UIScreen;
  onNavigate?: (target: string) => void;
}

/**
 * WebDynamicScreen — full-page wrapper for rendering a plugin's UIScreen.
 * Provides a scrollable container with title and delegates to WebDynamicRenderer.
 */
export function WebDynamicScreen({ screen, onNavigate }: WebDynamicScreenProps) {
  if (!screen || !screen.components) {
    return (
      <div className="sdui-screen sdui-screen-loading">
        <div className="sdui-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <PageContainer title={screen.title}>
      <div className="sdui-screen-content">
        <WebDynamicRenderer components={screen.components} onNavigate={onNavigate} />
      </div>
    </PageContainer>
  );
}

export default WebDynamicScreen;
