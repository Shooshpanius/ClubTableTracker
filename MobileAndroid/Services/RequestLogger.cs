using System;
using System.Collections.Generic;
using MobileAndroid.Models;

namespace MobileAndroid.Services
{
    public static class RequestLogger
    {
        private const int MaxEntries = 100;
        private static readonly object _lock = new object();
        private static readonly Queue<RequestLogEntry> _entries = new Queue<RequestLogEntry>();

        public static void Add(RequestLogEntry entry)
        {
            lock (_lock)
            {
                if (_entries.Count >= MaxEntries)
                    _entries.Dequeue();
                _entries.Enqueue(entry);
            }
        }

        public static List<RequestLogEntry> GetAll()
        {
            lock (_lock)
            {
                var list = new List<RequestLogEntry>(_entries);
                list.Reverse();
                return list;
            }
        }
    }
}
