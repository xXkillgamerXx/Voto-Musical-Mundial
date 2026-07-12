export const DEFAULT_ARTIST_BANNER =
  '/uploads/admin/artist-banner/1782781525589-ceb83658-97de-42f4-9471-f0902c29c1c5.png'

export const pickArtistImage = (artist) => {
  const metadata = artist?.metadata || {}

  return (
    artist?.image
    || artist?.imageUrl
    || artist?.photo
    || artist?.photoURL
    || artist?.photoUrl
    || artist?.foto
    || metadata.image
    || metadata.imageUrl
    || metadata.photo
    || metadata.photoURL
    || metadata.photoUrl
    || metadata.foto
    || ''
  )
}

export const resolveArtistCardImage = (artist) =>
  pickArtistImage(artist) || pickCustomArtistBanner(artist) || DEFAULT_ARTIST_BANNER

export const pickCustomArtistBanner = (artist) => {
  const metadata = artist?.metadata || {}

  return (
    artist?.banner
    || artist?.bannerUrl
    || artist?.cover
    || artist?.coverImage
    || artist?.portada
    || metadata.banner
    || metadata.bannerUrl
    || metadata.cover
    || metadata.coverImage
    || metadata.portada
    || ''
  )
}

export const resolveArtistBanner = (artist) =>
  pickCustomArtistBanner(artist) || DEFAULT_ARTIST_BANNER
