import { useFavourite } from '../FavouriteContext';

export function FavouriteStar({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { favouriteId, toggleFavourite } = useFavourite();
  const on = favouriteId === teamId;
  return (
    <button
      className={`star${on ? ' on' : ''}`}
      aria-pressed={on}
      title={on ? 'Remove favourite team' : `Make ${teamName} your favourite team`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavourite(teamId);
      }}
    >
      {on ? '★' : '☆'}
      <span className="star-label">{on ? 'My team' : 'Favourite'}</span>
    </button>
  );
}
