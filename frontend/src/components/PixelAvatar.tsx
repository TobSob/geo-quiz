import { avatarById } from '../features/avatars/avatarCatalog'

interface Props {
  id: string
  size?: number
  /** Gesperrte Avatare erscheinen ausgegraut. */
  locked?: boolean
  className?: string
  title?: string
}

/**
 * Rendert einen Avatar aus dem Katalog als Inline-SVG-Pixelsprite (16×16).
 * Der `body` (fertige <rect>-Liste) stammt aus unserem eigenen Katalog — daher
 * ist das dangerouslySetInnerHTML hier vertrauenswürdig.
 */
export function PixelAvatar({ id, size = 40, locked = false, className, title }: Props) {
  const spec = avatarById(id)
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title ?? spec.name}
      shapeRendering="crispEdges"
      style={{
        display: 'block',
        filter: locked ? 'grayscale(1) brightness(0.45)' : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: spec.body }}
    />
  )
}
