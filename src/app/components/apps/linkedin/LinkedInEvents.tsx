import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { CalendarDays, Search, Plus, Sparkles } from 'lucide-react';
import { useLinkedInEvents, useLinkedInInitialize } from '../../../hooks/useLinkedInData';

export function LinkedInEvents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { events, loading } = useLinkedInEvents();
  const { initialize, initialized } = useLinkedInInitialize();

  // Initialize default events on first load
  useEffect(() => {
    if (!initialized && events && events.length === 0) {
      initialize();
    }
  }, [events, initialized, initialize]);

  const filteredEvents = events.filter((event: any) => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.hashtags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'indian': return 'bg-orange-100 text-orange-700';
      case 'international': return 'bg-blue-100 text-blue-700';
      case 'industry': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getEventColor = (color: string) => {
    const colors: Record<string, string> = {
      orange: 'border-orange-300 bg-orange-50',
      purple: 'border-purple-300 bg-purple-50',
      pink: 'border-pink-300 bg-pink-50',
      yellow: 'border-yellow-300 bg-yellow-50',
      green: 'border-green-300 bg-green-50',
      blue: 'border-blue-300 bg-blue-50',
      red: 'border-red-300 bg-red-50',
    };
    return colors[color] || 'border-gray-300 bg-gray-50';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Events Calendar</h1>
        <p className="text-gray-600">Discover opportunities to create engaging content</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{events.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Indian Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {events.filter(e => e.category === 'indian').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">International Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {events.filter(e => e.category === 'international').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Industry Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {events.filter(e => e.category === 'industry').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search events or hashtags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              <Button
                variant={selectedCategory === 'indian' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('indian')}
                className={selectedCategory === 'indian' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                Indian
              </Button>
              <Button
                variant={selectedCategory === 'international' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('international')}
                className={selectedCategory === 'international' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                International
              </Button>
              <Button
                variant={selectedCategory === 'industry' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('industry')}
                className={selectedCategory === 'industry' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              >
                Industry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvents.map((event) => (
          <Card key={event.id} className={`border-2 ${getEventColor(event.color)}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Badge className={`${getCategoryColor(event.category)} mb-2`}>
                    {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                  </Badge>
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {new Date(event.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </CardDescription>
                </div>
                <CalendarDays className={`h-5 w-5 text-${event.color}-600`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">{event.description}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {event.hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}