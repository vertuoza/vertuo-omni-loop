// A round's context line (PRD 144): where the question came from, what the Claude session had cost
// when it asked, and how long the answer took — repo · branch · PRD #n · skill · model · tokens ·
// $cost · time to answer. Nothing at all for a round that says none of it (an older kit's).

export function ContextLine({ parts }: { parts: string[] | undefined }) {
  if (!parts || parts.length === 0) return null;
  return (
    <p className="ask-title ask-context" aria-label="Where this question came from">
      {parts.join(' · ')}
    </p>
  );
}
