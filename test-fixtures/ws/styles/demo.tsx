import styled from 'styled-components';

// 1. Completion: inside the template, type `var(` after `background: `
// 2. Quick fix: put the cursor on #3b82f6 or 1rem and press Cmd+.
// 3. Diagnostics: the typo on border-color should get a warning
const Button = styled.button`
  color: #3b82f6;
  padding: 1rem;
  background: ;
  border-color: var(--primry);
`;

// 4. Inline styles: type `var(` inside the quotes; hover and Cmd+click work on --primary too
export const Card = () => (
  <div style={{ color: 'var(--primary)', background: '' }}>
    <Button>Hello</Button>
  </div>
);
