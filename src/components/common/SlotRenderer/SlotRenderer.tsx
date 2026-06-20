import React from 'react';
import { usePluginManifests } from '../../../plugins/usePluginManifests';
import { SDUIRenderer } from '@saybridge/ui';
import { PluginIframe } from '../PluginIframe/PluginIframe';

interface SlotRendererProps {
	slot: string;
	context?: any;
}

export const SlotRenderer: React.FC<SlotRendererProps> = ({ slot, context }) => {
	const { slots } = usePluginManifests();
	const slotPlugins = slots[slot] || [];

	if (slotPlugins.length === 0) return null;

	return (
		<React.Fragment>
			{slotPlugins.map((plugin) => {
				if (plugin.render === 'sdui' && plugin.sdui_component) {
					// We pass the context to the SDUI component. SDUIRenderer can render custom schemas.
					// If the schema needs components wrap, we adapt it.
					const schema = Array.isArray(plugin.sdui_component) 
						? plugin.sdui_component 
						: [plugin.sdui_component];
					return (
						<div key={plugin.id} className={`slot-item slot-${slot}`}>
							<SDUIRenderer schema={schema} />
						</div>
					);
				}

				if (plugin.render === 'iframe' && plugin.iframe_src) {
					return (
						<div key={plugin.id} className={`slot-item slot-${slot}`} style={{ height: '100px' }}>
							<PluginIframe 
								src={plugin.iframe_src} 
								pluginSlug={plugin.pluginSlug} 
								context={context} 
							/>
						</div>
					);
				}

				return null;
			})}
		</React.Fragment>
	);
};
