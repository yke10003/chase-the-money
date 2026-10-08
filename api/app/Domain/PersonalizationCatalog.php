<?php

namespace App\Domain;

final class PersonalizationCatalog
{
    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        return [
            'work_categories' => [
                ['key' => 'software', 'label' => 'Software & tech'],
                ['key' => 'design', 'label' => 'Design & creative'],
                ['key' => 'sales', 'label' => 'Sales & marketing'],
                ['key' => 'operations', 'label' => 'Business / operations'],
                ['key' => 'finance', 'label' => 'Finance'],
                ['key' => 'trades', 'label' => 'Trades & practical work'],
                ['key' => 'teaching', 'label' => 'Teaching / education'],
                ['key' => 'hospitality', 'label' => 'Hospitality'],
                ['key' => 'healthcare', 'label' => 'Healthcare'],
                ['key' => 'student', 'label' => 'Student'],
                ['key' => 'other', 'label' => 'Other'],
            ],
            'skills' => [
                'software' => [
                    'Software development',
                    'Web development',
                    'Mobile apps',
                    'Product development',
                    'Technical consulting',
                    'DevOps / infrastructure',
                    'AI / automation',
                    'Data',
                    'Team leadership',
                ],
                'design' => ['Graphic design', 'Product design', 'Illustration', 'Photo / video', 'Writing'],
                'sales' => ['Sales', 'Marketing', 'Copywriting', 'Social media', 'Partnerships'],
                'operations' => ['Operations', 'Project coordination', 'Customer support', 'Admin'],
                'finance' => ['Bookkeeping', 'Financial analysis', 'Tax prep', 'Advice'],
                'trades' => ['Repairs', 'Making things', 'Moving / labour', 'Driving'],
                'teaching' => ['Tutoring', 'Workshops', 'Course design'],
                'hospitality' => ['Cooking', 'Events', 'Service'],
                'healthcare' => ['Care', 'Health advice', 'Admin'],
                'student' => ['Research', 'Campus jobs', 'Tutoring'],
                'other' => [],
            ],
            'experience_levels' => [
                ['key' => 'comfortable', 'label' => 'Comfortable'],
                ['key' => 'experienced', 'label' => 'Experienced'],
                ['key' => 'expert', 'label' => 'Expert'],
            ],
            'willing' => [
                ['key' => 'freelance', 'label' => 'Freelance work'],
                ['key' => 'sell', 'label' => 'Sell things I own'],
                ['key' => 'build_product', 'label' => 'Build a product'],
                ['key' => 'consult', 'label' => 'Consult / advise'],
                ['key' => 'resell', 'label' => 'Buy & resell'],
                ['key' => 'online_gigs', 'label' => 'Online gigs'],
                ['key' => 'local_work', 'label' => 'Local work'],
                ['key' => 'teach', 'label' => 'Teach'],
                ['key' => 'recover', 'label' => 'Recover money'],
                ['key' => 'reduce_expenses', 'label' => 'Reduce expenses'],
            ],
            'excluded' => [
                ['key' => 'delivery', 'label' => 'Delivery work'],
                ['key' => 'microtasks', 'label' => 'Low-paid microtasks'],
                ['key' => 'local_physical', 'label' => 'Local physical gigs'],
                ['key' => 'inventory', 'label' => 'Buying inventory'],
                ['key' => 'cold_calling', 'label' => 'Cold calling'],
            ],
            'availability' => [
                ['key' => 'little', 'label' => 'A little here and there'],
                ['key' => '1_3', 'label' => '1–3 hours/week'],
                ['key' => '4_8', 'label' => '4–8 hours/week'],
                ['key' => 'one_day', 'label' => '1 day/week'],
                ['key' => 'several_days', 'label' => 'Several days/week'],
                ['key' => 'varies', 'label' => 'Varies'],
            ],
            'starting_capital' => [
                ['key' => 'none', 'label' => '€0'],
                ['key' => 'up_to_50', 'label' => 'Up to €50'],
                ['key' => 'up_to_250', 'label' => 'Up to €250'],
                ['key' => 'up_to_1000', 'label' => 'Up to €1,000'],
                ['key' => 'more', 'label' => 'More if worthwhile'],
            ],
            'situation' => [
                ['key' => 'owns_sellable', 'label' => 'I own things I could sell'],
                ['key' => 'money_owed', 'label' => 'Someone owes me money'],
                ['key' => 'unpaid_invoice', 'label' => 'I have an unpaid invoice'],
                ['key' => 'freelance_lead', 'label' => 'I have a freelance lead'],
                ['key' => 'waiting_response', 'label' => 'I am waiting on a proposal or response'],
                ['key' => 'refund', 'label' => 'I may be due a refund'],
                ['key' => 'filing', 'label' => 'I need to file something that may return money'],
                ['key' => 'subscriptions', 'label' => 'I probably have unnecessary subscriptions'],
                ['key' => 'none', 'label' => 'None of these'],
            ],
            'money_hunt_categories' => [
                'Wardrobe',
                'Electronics',
                'Jewelry / metals',
                'Collectibles',
                'Tools',
                'Sports / hobby gear',
                'Furniture',
                'Storage',
            ],
        ];
    }
}
