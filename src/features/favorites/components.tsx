import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { addFavorite, fetchFavorites, removeFavorite } from './api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function useFavorites(enabled: boolean) {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: ({ signal }) => fetchFavorites(signal),
    enabled,
    staleTime: 15_000,
  })
}

export function FavoriteButton({ nftId, enabled }: { nftId: string; enabled: boolean }) {
  const queryClient = useQueryClient()
  const favorites = useFavorites(enabled)
  const isFavorite = favorites.data?.items.some((item) => item.nftId === nftId) ?? false
  const mutation = useMutation({
    mutationFn: () => (isFavorite ? removeFavorite(nftId) : addFavorite(nftId)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const previous = queryClient.getQueryData(['favorites'])
      queryClient.setQueryData(['favorites'], (current: { items: Array<{ nftId: string; nft?: unknown; createdAt?: string }> } | undefined) => {
        if (!current) return current
        return isFavorite ? { ...current, items: current.items.filter((item) => item.nftId !== nftId) } : current
      })
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['favorites'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  if (!enabled) return null
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className="h-12 rounded-xl px-4"
    >
      <Heart size={16} className={isFavorite ? 'fill-current text-primary' : ''} aria-hidden="true" />
      <span className="ml-2">{isFavorite ? 'Favorito' : 'Favoritar'}</span>
    </Button>
  )
}

export function FavoritesPage() {
  const favorites = useFavorites(true)
  if (favorites.isLoading) return <div className="mx-auto max-w-[1100px] px-5 py-12"><Skeleton className="shimmer h-48 rounded-3xl" /></div>
  if (favorites.isError) return <div className="mx-auto max-w-[760px] px-5 py-16 text-center">Nao foi possivel carregar favoritos.</div>
  const items = favorites.data?.items ?? []
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Favoritos</h1>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhuma obra salva ainda.</p> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.nftId} className="overflow-hidden rounded-2xl border-white/8 bg-card p-3">
              <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block">
                <img src={item.nft.image} alt={item.nft.name} className="aspect-[1.2/1] w-full rounded-xl object-cover" />
                <div className="px-1 pt-3">
                  <h3 className="font-semibold">{item.nft.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.nft.priceEth} ETH</p>
                </div>
              </Link>
              <div className="mt-3 px-1 pb-1"><FavoriteButton nftId={item.nftId} enabled /></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
