using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenIddict.Abstractions;
using Server.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Server
{
    public class Worker : IHostedService
    {
        private readonly IServiceProvider _serviceProvider;

        public Worker(IServiceProvider serviceProvider)
            => _serviceProvider = serviceProvider;

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();

            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await context.Database.EnsureCreatedAsync();

            var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

            if (await manager.FindByClientIdAsync("angular") is null)
            {
                await manager.CreateAsync(new OpenIddictApplicationDescriptor
                {
                    ClientId = "angular",
                    DisplayName = "Angular client application.",
                    Permissions =
                    {
                        OpenIddictConstants.Permissions.Endpoints.Token,
                        OpenIddictConstants.Permissions.Endpoints.Logout,

                        OpenIddictConstants.Permissions.GrantTypes.Password,
                        OpenIddictConstants.Permissions.GrantTypes.RefreshToken,

                        OpenIddictConstants.Permissions.Scopes.Email,
                        OpenIddictConstants.Permissions.Scopes.Roles,
                        OpenIddictConstants.Permissions.Scopes.Profile,
                    }
                });
            }
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}