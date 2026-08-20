export function PostSkeleton() {
  return (
    <div className="skeleton-post">
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
      <div className="col" style={{ gap: 8 }}>
        <div className="skeleton" style={{ width: "38%", height: 13 }} />
        <div className="skeleton" style={{ width: "92%", height: 12 }} />
        <div className="skeleton" style={{ width: "74%", height: 12 }} />
        <div className="row" style={{ gap: 18, marginTop: 6 }}>
          <div className="skeleton" style={{ width: 44, height: 11 }} />
          <div className="skeleton" style={{ width: 44, height: 11 }} />
          <div className="skeleton" style={{ width: 44, height: 11 }} />
        </div>
      </div>
    </div>
  )
}

export function PostListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
    </div>
  )
}

export function UserRowSkeleton() {
  return (
    <div className="card__row">
      <div className="skeleton" style={{ width: 34, height: 34, borderRadius: "50%" }} />
      <div className="col grow" style={{ gap: 6 }}>
        <div className="skeleton" style={{ width: "52%", height: 12 }} />
        <div className="skeleton" style={{ width: "34%", height: 10 }} />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div>
      <div className="skeleton" style={{ height: 168, borderRadius: 0 }} />
      <div className="profile__head">
        <div className="profile__avatar-row">
          <div
            className="skeleton"
            style={{ width: 92, height: 92, borderRadius: "50%" }}
          />
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div className="skeleton" style={{ width: 180, height: 16 }} />
          <div className="skeleton" style={{ width: 120, height: 12 }} />
          <div className="skeleton" style={{ width: "70%", height: 12 }} />
        </div>
      </div>
      <PostListSkeleton count={3} />
    </div>
  )
}
