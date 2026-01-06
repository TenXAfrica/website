import React, { useState, useEffect } from 'react';
import { GetStartedModal } from './GetStartedModal';

/**
 * Client-side wrapper for GetStartedModal that manages open/close state
 * and listens to custom events from buttons.
 */
export const GetStartedModalController: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleOpenModal = () => {
			setIsOpen(true);
		};

		// Listen for custom event
		window.addEventListener('openGetStartedModal', handleOpenModal);

		// Also try the button click approach as fallback
		const button = document.getElementById('get-started-btn');
		if (button) {
			button.addEventListener('click', handleOpenModal);
		}

		return () => {
			window.removeEventListener('openGetStartedModal', handleOpenModal);
			if (button) {
				button.removeEventListener('click', handleOpenModal);
			}
		};
	}, []);

	return (
		<GetStartedModal
			isOpen={isOpen}
			onClose={() => setIsOpen(false)}
		/>
	);
};
