// Custom properties declared in code, not in a token file.
export const Panel = ({ offset }: { offset: number }) => (
    <div style={{ '--dynamic-offset': `${offset}px` }} />
);
