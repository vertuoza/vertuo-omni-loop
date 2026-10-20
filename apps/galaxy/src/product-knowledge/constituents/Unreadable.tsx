// What a Knowledge section draws when its rows cannot be read (PRD 2240 s4): one line, the page still opens.

export const Unreadable = ({ what }: { what: string }) => <p className="business-refusal" role="alert">{`Couldn’t load the ${what}. Reload in a moment.`}</p>;
