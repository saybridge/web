import React from 'react';
import * as Icons from 'lucide-react';

interface DynamicIconProps {
	name: string;
	size?: number;
	className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 16, className }) => {
	// Try to match icon by name, capitalizing first letter just in case
	const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
	let IconComponent = (Icons as any)[capitalized] || (Icons as any)[name];

	// Map some legacy / alternate names
	if (!IconComponent) {
		if (name === 'edit' || name === 'edit2') {
			IconComponent = Icons.Edit;
		} else if (name === 'star') {
			IconComponent = Icons.Star;
		} else if (name === 'pin') {
			IconComponent = Icons.Pin;
		}
	}

	if (!IconComponent) {
		// Fallback to a generic icon if the name doesn't match
		const FallbackIcon = Icons.HelpCircle;
		return <FallbackIcon size={size} className={className} />;
	}

	return <IconComponent size={size} className={className} />;
};
