import type { Person } from "../models/Person";
import { initialsFromName } from "../utils/contactSearch";
import { SoftGoldDot } from "./common/GoldBullets";

type Props = {
  results: Person[];
  onSelect: (person: Person) => void;
};

export default function ContactsSearchResults({ results, onSelect }: Props) {
  return (
    <div className="contacts-search-results">
      {results.length === 0 ? (
        <div className="empty-results">No matching contacts.</div>
      ) : (
        results.map((person) => (
          <button
            key={person.id}
            type="button"
            className="contact-row"
            onClick={() => onSelect(person)}
          >
            <div className="contact-left">
              <SoftGoldDot className="contact-dot" />
              <div className="contact-avatar" aria-hidden="true">
                {initialsFromName(person.name)}
              </div>
            </div>
            <div className="contact-name">{person.name}</div>
          </button>
        ))
      )}
    </div>
  );
}
