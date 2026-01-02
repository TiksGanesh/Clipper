"use client";
import React, { useState } from "react";

type ActionFn = () => Promise<{ success: boolean; message?: string; error?: string }>;

interface ActionButtonProps {
    label: string;
    confirm: string;
    action: ActionFn;
    variant?: 'default' | 'danger';
}

export default function ActionButton({ label, confirm, action, variant = 'default' }: ActionButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (!window.confirm(confirm)) {
            return;
        }

        setIsLoading(true);
        try {
            const result = await action();
            
            if (result.success) {
                alert(result.message || 'Action completed successfully');
                // Reload page to show updated data
                window.location.reload();
            } else {
                alert(`Error: ${result.error || 'Action failed'}`);
            }
        } catch (error) {
            console.error('Action error:', error);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const baseClasses = "px-4 py-2 rounded border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClasses = variant === 'danger'
        ? "bg-red-50 hover:bg-red-100 border-red-200 text-red-800"
        : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-800";

    return (
        <button
            type="button"
            className={`${baseClasses} ${variantClasses}`}
            onClick={handleClick}
            disabled={isLoading}
        >
            {isLoading ? 'Processing...' : label}
        </button>
    );
}