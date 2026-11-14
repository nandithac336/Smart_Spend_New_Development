import { Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx'
import CategoryCreator from '@/components/categories/CategoryCreator.jsx'

function TransactionFormReferences({
  type,
  onCategoryCreated,
  control,
  errors,
  wallets,
  walletsLoading,
  walletsError,
  refetchWallets,
  categories,
  categoriesLoading,
  categoriesError,
  refetchCategories,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="transaction-wallet">Wallet</label>
        <Controller
          control={control}
          name="walletId"
          render={({ field }) => (
            <Select disabled={walletsLoading || walletsError || wallets.length === 0} onValueChange={field.onChange} value={field.value}>
              <SelectTrigger aria-invalid={Boolean(errors.walletId)} className="h-10 w-full" id="transaction-wallet"><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>{wallets.map((wallet) => <SelectItem key={wallet.id ?? wallet._id} value={wallet.id ?? wallet._id}>{wallet.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        />
        {errors.walletId && <p className="text-xs text-destructive">{errors.walletId.message}</p>}
        {walletsLoading && <p className="text-xs text-muted-foreground" role="status">Loading wallets…</p>}
        {walletsError && (
          <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
            Couldn’t load wallets.
            <Button onClick={() => refetchWallets()} size="sm" type="button" variant="outline">Retry</Button>
          </div>
        )}
        {!walletsLoading && !walletsError && wallets.length === 0 && <p className="text-xs text-destructive">Add a wallet before creating a transaction.</p>}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="transaction-category">Category</label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select disabled={categoriesLoading || categoriesError} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
              <SelectTrigger aria-invalid={Boolean(errors.categoryId)} className="h-10 w-full" id="transaction-category"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((category) => <SelectItem key={category.id ?? category._id} value={category.id ?? category._id}>{category.icon} {category.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
        {categoriesLoading && <p className="text-xs text-muted-foreground" role="status">Loading categories…</p>}
        {categoriesError && (
          <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
            Couldn’t load categories.
            <Button onClick={() => refetchCategories()} size="sm" type="button" variant="outline">Retry</Button>
          </div>
        )}
        {!categoriesError && (
          <CategoryCreator categories={categories} disabled={categoriesLoading} onCreated={onCategoryCreated} type={type} />
        )}
      </div>
    </div>
  )
}

export default TransactionFormReferences
