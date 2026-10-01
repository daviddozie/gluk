import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    className?: string;
}

/**
 * PDF Icon
 * Distinctive red folded-page document with bold "PDF" label.
 */
export function PdfIcon({
    size = 28,
    color = "#EF4444",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {/* Document arch with folded top-right corner */}
            <path
                d="M7 19V7a3 3 0 0 1 3-3h9l6 6v9"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Fold flap */}
            <path
                d="M19 4v5a1.5 1.5 0 0 0 1.5 1.5H25"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* PDF typography */}
            <text
                x="16"
                y="27"
                textAnchor="middle"
                fill={color}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="0.5"
            >
                PDF
            </text>
        </svg>
    );
}

/**
 * CSV Icon
 * Distinctive green folded-page document with bold "CSV" label.
 */
export function CsvIcon({
    size = 28,
    color = "#10B981",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {/* Document arch with folded top-right corner */}
            <path
                d="M7 19V7a3 3 0 0 1 3-3h9l6 6v9"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Fold flap */}
            <path
                d="M19 4v5a1.5 1.5 0 0 0 1.5 1.5H25"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* CSV typography */}
            <text
                x="16"
                y="27"
                textAnchor="middle"
                fill={color}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="0.5"
            >
                CSV
            </text>
        </svg>
    );
}

/**
 * Word / Docs Icon
 * Distinctive blue folded-page document with bold "DOC" label.
 */
export function DocIcon({
    size = 28,
    color = "#3B82F6",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {/* Document arch with folded top-right corner */}
            <path
                d="M7 19V7a3 3 0 0 1 3-3h9l6 6v9"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Fold flap */}
            <path
                d="M19 4v5a1.5 1.5 0 0 0 1.5 1.5H25"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* DOC typography */}
            <text
                x="16"
                y="27"
                textAnchor="middle"
                fill={color}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="0.5"
            >
                DOC
            </text>
        </svg>
    );
}

/**
 * Markdown / Text Document Icon
 * Rounded card with two horizontal document content lines.
 */
export function MarkdownIcon({
    size = 28,
    color = "#3B82F6",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <rect
                x="7"
                y="5"
                width="18"
                height="22"
                rx="4"
                stroke={color}
                strokeWidth="2.2"
            />
            <line
                x1="12"
                y1="13"
                x2="20"
                y2="13"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <line
                x1="12"
                y1="18.5"
                x2="17"
                y2="18.5"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export const TxtIcon = MarkdownIcon;

/**
 * Generic File Fallback Icon
 */
export function GenericFileIcon({
    size = 28,
    color = "#9CA3AF",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <path
                d="M7 25V7a3 3 0 0 1 3-3h9l6 6v15a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M19 4v5a1.5 1.5 0 0 0 1.5 1.5H25"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <line
                x1="12"
                y1="17"
                x2="20"
                y2="17"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
            />
            <line
                x1="12"
                y1="21"
                x2="17"
                y2="21"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * Image File Icon
 * Rounded card with mountains and sun.
 */
export function ImageIcon({
    size = 28,
    color = "#A855F7",
    className = "",
    ...props
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <rect
                x="5"
                y="5"
                width="22"
                height="22"
                rx="4"
                stroke={color}
                strokeWidth="2.2"
            />
            <circle cx="11.5" cy="11.5" r="2.2" fill={color} />
            <path
                d="M6.5 23l7-7.5 5 5.5 3.5-3.5 4 4"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export type FileCategory = "pdf" | "csv" | "doc" | "txt" | "image" | "other";

/**
 * Determine file category based on filename and MIME type
 */
export function getFileCategory(fileName?: string, mimeType?: string): FileCategory {
    const name = (fileName || "").toLowerCase();
    const mime = (mimeType || "").toLowerCase();

    if (name.endsWith(".pdf") || mime === "application/pdf") {
        return "pdf";
    }

    if (name.endsWith(".csv") || mime === "text/csv") {
        return "csv";
    }

    if (
        name.endsWith(".docx") ||
        name.endsWith(".doc") ||
        name.endsWith(".odt") ||
        name.endsWith(".rtf") ||
        mime.includes("word") ||
        mime.includes("officedocument.wordprocessingml")
    ) {
        return "doc";
    }

    if (
        name.endsWith(".txt") ||
        name.endsWith(".md") ||
        name.endsWith(".markdown") ||
        mime === "text/plain" ||
        mime === "text/markdown"
    ) {
        return "txt";
    }

    if (
        mime.startsWith("image/") ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".gif") ||
        name.endsWith(".webp") ||
        name.endsWith(".svg")
    ) {
        return "image";
    }

    return "other";
}

export interface FileIconProps extends IconProps {
    fileName?: string;
    fileType?: string;
    category?: FileCategory;
}

/**
 * Unified FileIcon Component
 * Automatically determines and renders the appropriate SVG icon.
 */
export function FileIcon({
    fileName,
    fileType,
    category,
    size = 28,
    color,
    className = "",
    ...props
}: FileIconProps) {
    const resolvedCategory = category || getFileCategory(fileName, fileType);

    switch (resolvedCategory) {
        case "pdf":
            return <PdfIcon size={size} color={color} className={className} {...props} />;
        case "csv":
            return <CsvIcon size={size} color={color} className={className} {...props} />;
        case "doc":
            return <DocIcon size={size} color={color} className={className} {...props} />;
        case "txt":
            return <MarkdownIcon size={size} color={color} className={className} {...props} />;
        case "image":
            return <ImageIcon size={size} color={color} className={className} {...props} />;
        default:
            return <GenericFileIcon size={size} color={color} className={className} {...props} />;
    }
}

export default FileIcon;

