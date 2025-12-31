"use client";
import React from "react";

export default function ActionButton({ label, confirm }: { label: string; confirm: string }) {
    return (
        <button
            type="button"
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 border text-sm font-medium text-gray-800"
            onClick={() => {
                if (window.confirm(confirm)) {
                    // TODO: Implement mutation logic
                    alert(`Action: ${label} (not implemented)`);
                }
            }}
        >
            {label}
        </button>
    );
}