import type { FC } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, X, Zap } from 'lucide-react';

interface ProductFormData {
	title: string;
	description: string;
	price: string;
	category: string;
	product_type: 'physical' | 'digital' | 'service';
	tags: string[];
	images: File[];
	files: File[];
	// Sale / deals fields
	is_on_sale?: boolean;
	sale_price?: string;
	sale_starts?: string;
	sale_ends?: string;
	is_deals_of_day?: boolean;
}

interface ProductFormFieldsProps {
	formData: ProductFormData;
	currentTag: string;
	onInputChange: (field: keyof ProductFormData, value: any) => void;
	onTagChange: (tag: string) => void;
	onAddTag: () => void;
	onRemoveTag: (tag: string) => void;
	storeCurrency: string;
	onChangeCurrency: () => void;
}

export const ProductFormFields: FC<ProductFormFieldsProps> = ({
	formData,
	currentTag,
	onInputChange,
	onTagChange,
	onAddTag,
	onRemoveTag,
	storeCurrency,
	onChangeCurrency
}) => {
	const categories = [
		'Electronics & Tech',
		'Fashion & Clothing',
		'Home & Garden',
		'Health & Beauty',
		'Sports & Outdoors',
		'Books & Media',
		'Food & Beverages',
		'Arts & Crafts',
		'Digital Products',
		'Other'
	];

	// Digital-specific categories
	const digitalCategories = ['Music', 'Audiobook', 'eBook', 'Shortfilms'];

	const categoriesForSelect = formData.product_type === 'digital' ? digitalCategories : categories;

	return (
		<div className="space-y-6">
			{/* Product Type Selection */}
			<div className="space-y-3">
				<Label className="text-lg font-semibold">Product Type</Label>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
						<input
							type="radio"
							value="physical"
							checked={formData.product_type === 'physical'}
							onChange={(e) => onInputChange('product_type', e.target.value)}
							className="text-purple-600"
						/>
						<div>
							<span className="font-medium">Physical Product</span>
							<p className="text-sm text-gray-500">Tangible items that require shipping</p>
						</div>
					</label>

					<label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
						<input
							type="radio"
							value="digital"
							checked={formData.product_type === 'digital'}
							onChange={(e) => onInputChange('product_type', e.target.value)}
							className="text-purple-600"
						/>
						<div>
							<span className="font-medium">Digital Product</span>
							<p className="text-sm text-gray-500">Downloadable files, software, etc.</p>
						</div>
					</label>
				</div>
			</div>

			{/* Basic Information */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-2">
					<Label htmlFor="title">Product Title *</Label>
					<Input
						id="title"
						value={formData.title}
						onChange={(e) => onInputChange('title', e.target.value)}
						placeholder="Enter product title"
						required
						className="h-12"
					/>

					{/* Deals of the Day Toggle - Moved under Product Title */}
					<div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
						<div className="flex items-center space-x-3">
							<Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
							<div>
								<Label className="font-semibold text-yellow-800 dark:text-yellow-200">
									List on Deals of the Day
								</Label>
								<p className="text-sm text-yellow-600 dark:text-yellow-400">
									Feature this product in the Square page deals section
								</p>
							</div>
						</div>
						<Switch
							checked={!!formData.is_deals_of_day}
							onCheckedChange={(checked) => onInputChange('is_deals_of_day', checked)}
							className="data-[state=checked]:bg-yellow-600"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="price">Price ({storeCurrency}) *</Label>
						<Button type="button" variant="ghost" size="sm" onClick={onChangeCurrency}>
							Change Base Currency
						</Button>
					</div>

					<Input
						id="price"
						type="number"
						step="0.01"
						min="0"
						value={formData.price}
						onChange={(e) => onInputChange('price', e.target.value)}
						placeholder={`0.00 (${storeCurrency})`}
						required
						className="h-12"
					/>

					{/* Sale controls: sale toggle, sale price and period */}
					<div className="mt-3 grid grid-cols-1 gap-2">
						<div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
							<div className="flex items-center space-x-3">
								<div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
								<div>
									<Label className="font-semibold text-blue-800 dark:text-blue-200">
										Put on Sale
									</Label>
									<p className="text-sm text-blue-600 dark:text-blue-400">
										Set a discounted price for this product
									</p>
								</div>
							</div>
							<Switch
								checked={!!formData.is_on_sale}
								onCheckedChange={(checked) => onInputChange('is_on_sale', checked)}
								className="data-[state=checked]:bg-blue-600"
							/>
						</div>

						{formData.is_on_sale && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/10">
								<div className="space-y-2">
									<Label htmlFor="sale_price">Sale Price ({storeCurrency})</Label>
									<Input
										id="sale_price"
										type="number"
										step="0.01"
										min="0"
										value={formData.sale_price || ''}
										onChange={(e) => onInputChange('sale_price', e.target.value)}
										placeholder={`Sale price (${storeCurrency})`}
										className="h-10"
									/>
								</div>

								<div className="space-y-2">
									<Label>Sale Period</Label>
									<div className="grid grid-cols-1 gap-2">
										<input
											type="datetime-local"
											value={formData.sale_starts || ''}
											onChange={(e) => onInputChange('sale_starts', e.target.value)}
											className="h-10 rounded border p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
										/>

										<input
											type="datetime-local"
											value={formData.sale_ends || ''}
											onChange={(e) => onInputChange('sale_ends', e.target.value)}
											className="h-10 rounded border p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="category">Category</Label>
				<select
					id="category"
					value={formData.category}
					onChange={(e) => onInputChange('category', e.target.value)}
					className="h-12 rounded border p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
				>
					<option value="">Select a category</option>
					{categoriesForSelect.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					value={formData.description}
					onChange={(e) => onInputChange('description', e.target.value)}
					placeholder={
						formData.product_type === 'digital'
							? 'Describe your digital product, features, requirements, etc...'
							: 'Describe your product, features, specifications, etc...'
					}
					rows={6}
					className="resize-none"
				/>
			</div>

			{/* Tags */}
			<div className="space-y-3">
				<Label>Tags</Label>
				<div className="flex space-x-2">
					<Input
						value={currentTag}
						onChange={(e) => onTagChange(e.target.value)}
						placeholder="Add a tag"
						onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
						className="h-12"
					/>

					<Button type="button" onClick={onAddTag} size="lg" className="px-6">
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{formData.tags.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-3">
						{formData.tags.map((tag, index) => (
							<Badge key={index} variant="secondary" className="flex items-center space-x-2 py-2 px-3">
								<span>{tag}</span>
								<button
									type="button"
									onClick={() => onRemoveTag(tag)}
									className="ml-1 hover:text-red-500"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>
		</div>
	);
};