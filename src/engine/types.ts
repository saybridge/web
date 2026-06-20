// SDUI Engine Type Definitions for Web
// Mirrors mobile/src/engine/types.ts — shared schema from backend UIManifest

export interface UIComponent {
  type:
    | 'text_input'
    | 'button'
    | 'submit_button'
    | 'toggle'
    | 'list'
    | 'status_card'
    | 'image'
    | 'text'
    | 'search_bar'
    | 'card_grid'
    | 'data_table'
    | 'chip_group'
    | 'section'
    | 'tabs'
    | 'modal'
    | 'detail_header';
  props: Record<string, any>;
}

export interface UIScreen {
  id: string;
  title: string;
  placement: 'settings' | 'admin' | 'chat_menu';
  components?: UIComponent[];
  iframe_src?: string;
}

export interface LoginExtension {
  trigger: string;
  screen?: UIScreen;
  buttons?: UIComponent[];
}

export interface AdminMenu {
  label: string;
  icon: string;
  priority: number;
}

export interface UIManifest {
  id: string;
  name: string;
  icon: string;
  screens?: UIScreen[];
  login_extension?: LoginExtension;
  admin_menu?: AdminMenu;
  admin_screens?: UIScreen[];
}
